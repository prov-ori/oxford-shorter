import {createHash} from 'node:crypto';
const assert=(ok,message)=>{if(!ok)throw Error('Book links: '+message);};
export function compileBookLinks(specs,books,bank){
  const ids=new Set(),retired=new Set(bank.retiredQuestionIds||[]);
  const topics=specs.map(spec=>{
    assert(/^[a-z][a-z0-9-]+$/.test(spec.id)&&!ids.has(spec.id),'duplicate/invalid id '+spec.id);ids.add(spec.id);
    for(const key of ['title','group','comparison','distinguish'])assert(typeof spec[key]==='string'&&spec[key].trim(),key+' missing in '+spec.id);
    assert(Array.isArray(spec.aliases)&&spec.aliases.every(x=>typeof x==='string'),'aliases in '+spec.id);
    const sources={};
    for(const key of ['fish','oxford']){
      const book=books[key],ref=spec[key];
      const chapter=book.chapters.find(c=>c.sections.some(s=>s.id===ref.section));
      const section=chapter?.sections.find(s=>s.id===ref.section);
      assert(section&&['translated','reviewed'].includes(section.status),'missing or incomplete '+key+' '+ref.section);
      const hits=section.blocks.map((b,i)=>({b,i})).filter(({b})=>b.type==='paragraph'&&b.text.includes(ref.match));
      assert(ref.match.length>20&&hits.length===1,'ambiguous/missing evidence '+spec.id+' '+key);
      assert(typeof ref.focus==='string'&&ref.focus.trim(),'source focus '+spec.id);
      const {b,i}=hits[0],heading=section.blocks.slice(0,i).filter(b=>b.type==='heading').at(-1)?.text||section.title;
      sources[key]={book:key,bookId:book.id,edition:book.edition,revision:book.revision,sourceSha256:book.source.sha256,sectionId:section.id,chapter:chapter.title,title:section.title,heading,block:i,quote:b.text,quoteSha256:createHash('sha256').update(b.text).digest('hex'),focus:ref.focus,pdfStart:section.source.pdfStart,pdfEnd:section.source.pdfEnd,printedPages:section.source.printedPages||'',href:(key==='fish'?'fish.html':'index.html')+'#section='+section.id+'&block='+i};
    }
    const q=bank.questions.find(q=>q.id===spec.taskId);
    assert(q&&!retired.has(q.id),'missing or retired task '+spec.taskId);
    assert(['application','understanding'].includes(q.difficulty),'task must test a distinction '+q.id);
    assert(q.sectionId===sources[q.book]?.sectionId,'task outside compared sources '+q.id);
    const s=books[q.book].chapters.flatMap(c=>c.sections).find(s=>s.id===q.sectionId);
    // A task may cite another paragraph in the same section; verify that evidence too.
    const text=b=>b.text||[...(b.items||[]),...(b.blocks||[]).map(text)].join('\n');
    assert(s.blocks.some(b=>text(b).includes(q.sourceEvidence)),'task evidence no longer present '+q.id);
    return {id:spec.id,title:spec.title,group:spec.group,aliases:spec.aliases,comparison:spec.comparison,distinguish:spec.distinguish,sources,task:{id:q.id,title:q.topic,book:q.book,difficulty:q.difficulty,href:'quiz.html?book='+q.book+'&chapter='+q.chapter+'&question='+q.id}};
  });
  return {schemaVersion:1,revision:1,topics};
}
