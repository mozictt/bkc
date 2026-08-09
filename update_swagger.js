const fs = require('fs');
const path = require('path');

const dtoFiles = [
  'src/menu/dto/update-menu.dto.ts',
  'src/menu/dto/create-menu.dto.ts',
  'src/menu/dto/update-permission.dto.ts',
  'src/role/dto/create-role.dto.ts',
  'src/role/dto/update-role.dto.ts',
  'src/barang/dto/update-kategori.dto.ts',
  'src/barang/dto/update-barang.dto.ts',
  'src/barang/dto/create-kategori.dto.ts',
  'src/barang/dto/create-barang.dto.ts',
  'src/barang/dto/create-bulk-barang.dto.ts',
  'src/gallery/dto/create-gallery.dto.ts',
  'src/gallery/dto/create-album.dto.ts',
  'src/gallery/dto/update-gallery.dto.ts'
];

dtoFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if ApiProperty is already imported
  if (content.includes('@nestjs/swagger')) {
    console.log(`Skipping ${file}`);
    return;
  }

  // Add import statement
  content = "import { ApiProperty } from '@nestjs/swagger';\n" + content;

  // Add @ApiProperty() before every class property decorator block
  // A property typically starts with decorators like @IsString, @IsOptional, then the property name.
  // We can inject @ApiProperty() right before the first decorator of a property block.
  
  // This regex looks for lines that start with `@Is` or `@Validate` and injects @ApiProperty() before them
  // We need to be careful to group multiple decorators so we don't insert it multiple times per property.
  
  const propertyBlocks = content.split('\n');
  let newContent = [];
  let inPropertyBlock = false;

  for (let i = 0; i < propertyBlocks.length; i++) {
    const line = propertyBlocks[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('@Is') || trimmed.startsWith('@Validate') || trimmed.startsWith('@Transform') || trimmed.startsWith('@Type')) {
      if (!inPropertyBlock) {
        // Find the property name to guess a good example
        let propName = 'property';
        let type = 'string';
        for (let j = i + 1; j < propertyBlocks.length; j++) {
           const l = propertyBlocks[j].trim();
           if (!l.startsWith('@') && l.includes(':')) {
             propName = l.split(':')[0].trim().replace('?', '');
             type = l.split(':')[1].replace(';', '').trim();
             break;
           }
        }
        
        let example = "'example_value'";
        if (type === 'number') example = '1';
        else if (type === 'boolean') example = 'true';
        else if (type.includes('[]')) example = '[]';
        else if (propName.includes('id') || propName.includes('Id')) example = '1';
        else if (propName === 'name') example = "'Sample Name'";
        else if (propName === 'description') example = "'Sample Description'";
        else if (propName === 'url') example = "'http://example.com'";
        else if (propName === 'icon') example = "'icon-name'";

        newContent.push(`  @ApiProperty({ example: ${example} })`);
        inPropertyBlock = true;
      }
    } else if (!trimmed.startsWith('@')) {
      inPropertyBlock = false;
    }
    
    newContent.push(line);
  }

  fs.writeFileSync(filePath, newContent.join('\n'));
  console.log(`Updated ${file}`);
});
