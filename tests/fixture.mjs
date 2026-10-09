// Synthetic content exclusively for software QA. Never included in dist.
export const fixture = {
  schemaVersion:1, id:'shorter-oxford-psychiatry-8-ru', revision:1,
  title:'Тестовая книга — не материал учебника', edition:'Тест',
  source:{filename:'synthetic-test.pdf', sha256:'a'.repeat(64),pageCount:5}, outlineComplete:true,
  glossary:[{en:'test',ru:'тестовый',note:'Пример для проверки интерфейса.'}],
  chapters:[{id:'test-chapter',title:'Тестовая глава',originalTitle:'Synthetic chapter',sections:[
    {id:'test-first',title:'Первый тестовый раздел',originalTitle:'Synthetic first section',level:1,revision:1,status:'translated',checkedAgainstSourceAt:'2026-10-08',source:{pdfStart:1,pdfEnd:2,printedPages:'1–2'},blocks:[{type:'paragraph',text:'Это тестовый текст для проверки интерфейса. Он не содержит сведений из учебника.'},{type:'paragraph',text:'<img src=x onerror=alert(1)> должен отображаться как обычный текст.'},{type:'table',caption:'Тестовая таблица',headers:['Один','Два'],rows:[['А','Б']]},{type:'box',title:'Тестовая вставка',blocks:[{type:'list',items:['Первый пункт','Второй пункт']}]}],summary:['Тестовый тезис, не относящийся к учебнику.']},
    {id:'test-pending',title:'Ожидающий раздел',originalTitle:'Pending section',level:2,revision:1,status:'pending',source:{pdfStart:3,pdfEnd:3},blocks:[],summary:[]},
    {id:'test-last',title:'Последний тестовый раздел',originalTitle:'Last section',level:1,revision:1,status:'draft',source:{pdfStart:4,pdfEnd:5},blocks:[{type:'paragraph',text:'Тестовый черновик.'}],summary:[]}
  ]}]
};
