import fs from 'node:fs/promises';
import {fishBook} from '../content/fish-006.mjs';
const output=new URL('../dist/data/',import.meta.url);
await fs.mkdir(output,{recursive:true});
await fs.writeFile(new URL('fish.json',output),JSON.stringify(fishBook,null,2));
await fs.writeFile(new URL('fish.js',output),'window.STUDY_BOOK_ID='+JSON.stringify(fishBook.id)+';window.STUDY_BOOK='+JSON.stringify(fishBook)+';');

