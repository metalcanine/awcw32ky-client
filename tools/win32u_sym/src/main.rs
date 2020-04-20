use std::convert::TryInto;
use std::fs::File;
use std::io::Read;
use std::io::Seek;
use std::io::SeekFrom;

fn read_u16le(file: &mut File) -> u16 {
    let mut buffer: [u8; 2] = [0; 2];
    file.read_exact(&mut buffer).unwrap();
    u16::from_le_bytes(buffer)
}

fn read_u32le(file: &mut File) -> u32 {
    let mut buffer: [u8; 4] = [0; 4];
    file.read_exact(&mut buffer).unwrap();
    u32::from_le_bytes(buffer)
}

fn u32_from_le_byte_slice(slice: &[u8]) -> u32 {
    let fixed_array: [u8; 4] = (&slice[0..4]).try_into().unwrap();
    u32::from_le_bytes(fixed_array)
}

struct SectionInfo {
    virtual_size: u32,
    virtual_address: u32,
    file_offset: u32,
}

struct SectionTable(Vec<SectionInfo>);

impl SectionTable {
    pub fn from_file(
        file: &mut File,
        section_table_offset: u32,
        num_sections: u16,
    ) -> std::io::Result<SectionTable> {
        let mut section_table: Vec<SectionInfo> = Vec::new();

        file.seek(SeekFrom::Start(section_table_offset as u64))
            .unwrap();

        for _ in 0..num_sections {
            let mut section_data = [0u8; 40];
            file.read_exact(&mut section_data)?;

            let section_info = SectionInfo {
                virtual_size: u32_from_le_byte_slice(&section_data[8..12]),
                virtual_address: u32_from_le_byte_slice(&section_data[12..16]),
                file_offset: u32_from_le_byte_slice(&section_data[20..24]),
            };

            section_table.push(section_info);
        }

        Ok(SectionTable(section_table))
    }

    pub fn rva_to_file_offset(&self, rva: u32) -> Result<u32, ()> {
        for section_info in &self.0 {
            let section_virtual_end = section_info.virtual_address + section_info.virtual_size;
            if (rva >= section_info.virtual_address) && (rva < section_virtual_end) {
                let offset_into_section = rva - section_info.virtual_address;
                return Ok(section_info.file_offset + offset_into_section);
            }
        }

        Err(())
    }
}

fn main() {
    // Build the path to win32u.dll
    let windows_path = std::env::var_os("SystemRoot").unwrap();

    let mut win32u_path = std::path::PathBuf::new();

    win32u_path.push(windows_path);
    win32u_path.push("System32");
    win32u_path.push("win32u.dll");

    // Open the file and jump to the Portable Executable header
    let mut winu32_file = File::open(&win32u_path).expect("Failed to open Win32u.dll");

    winu32_file.seek(SeekFrom::Start(0x3c)).unwrap();

    let pe_header_offset = read_u32le(&mut winu32_file);

    winu32_file
        .seek(SeekFrom::Start(pe_header_offset as u64))
        .unwrap();

    // Check for the "PE\0\0" at the start
    let pe_bytes = read_u32le(&mut winu32_file);
    assert!(pe_bytes == 0x00004550);

    // Calculate some offsets relative to the PE header
    let coff_header_offset = pe_header_offset + 4;
    let image_header_offset = coff_header_offset + 20;
    let data_directories_offset = image_header_offset + 112;

    // Check the machine type for x86-64
    winu32_file
        .seek(SeekFrom::Start(coff_header_offset as u64))
        .unwrap();
    let arch = read_u16le(&mut winu32_file);
    assert!(arch == 0x8664);

    // Get the number of PE sections
    let num_sections = read_u16le(&mut winu32_file);

    // Calculate the offset to the section table
    winu32_file.seek(SeekFrom::Current(0xc)).unwrap();
    let image_header_size = read_u16le(&mut winu32_file);
    let section_table_offset = image_header_offset + image_header_size as u32;

    // Check for PE32+ file format
    winu32_file
        .seek(SeekFrom::Start(image_header_offset as u64))
        .unwrap();
    let file_type = read_u16le(&mut winu32_file);
    assert!(file_type == 0x20b);

    // Decode the section table for resolving RVAs to file offsets
    let section_table =
        SectionTable::from_file(&mut winu32_file, section_table_offset, num_sections).unwrap();

    // Get the file offset and size of the export directory
    winu32_file
        .seek(SeekFrom::Start(data_directories_offset as u64))
        .unwrap();
    let export_directory_address = read_u32le(&mut winu32_file);
    let export_directory_offset = section_table
        .rva_to_file_offset(export_directory_address)
        .unwrap();

    // Parse the export directory
    let mut export_directory_bytes = [0u8; 40];
    winu32_file
        .seek(SeekFrom::Start(export_directory_offset as u64))
        .unwrap();
    winu32_file.read_exact(&mut export_directory_bytes).unwrap();

    let num_export_names = u32_from_le_byte_slice(&export_directory_bytes[24..28]);

    let export_name_ptr_table_address = u32_from_le_byte_slice(&export_directory_bytes[32..36]);
    let export_name_ptr_table_offset = section_table
        .rva_to_file_offset(export_name_ptr_table_address)
        .unwrap();

    // Read the table of pointers to the export names into a vector
    winu32_file
        .seek(SeekFrom::Start(export_name_ptr_table_offset as u64))
        .unwrap();

    let mut export_name_ptr_table: Vec<u32> = Vec::new();

    for _ in 0..num_export_names {
        let mut export_name_ptr_bytes = [0u8; 4];
        winu32_file.read_exact(&mut export_name_ptr_bytes).unwrap();
        let export_name_ptr = u32::from_le_bytes(export_name_ptr_bytes);
        let export_name_offset = section_table.rva_to_file_offset(export_name_ptr).unwrap();
        export_name_ptr_table.push(export_name_offset);
    }

    // Go through the pointer table and actually read all the export names into a vector

    let mut export_names: Vec<String> = Vec::new();

    for export_offset in export_name_ptr_table.iter().cloned() {
        let mut export_name_bytes: Vec<u8> = Vec::new();

        winu32_file
            .seek(SeekFrom::Start(export_offset as u64))
            .unwrap();
        loop {
            let mut b = [0u8; 1];
            winu32_file.read_exact(&mut b).unwrap();
            if b[0] == 0 {
                break;
            }
            export_name_bytes.push(b[0]);
        }

        let export_name = std::str::from_utf8(&export_name_bytes).unwrap();
        export_names.push(export_name.to_string());        
    }

    // Output everything
    println!("const WIN32K_SYSCALLS = [");

    for export_name in export_names.iter() {
        println!("  '{}',", export_name);
    }

    println!("];");
}
