/*
 * Бани Вятки · сентябрь 2026 · обезличенные агрегаты.
 * CRM-выгрузка: 222 сделки, созданные в сентябре, текущие ответственные и стадии.
 * Отчет сентября: персонально распределены только 10 договоров, 4 318 000 ₽.
 * Уточнённый итог: 13 договоров, 5 643 000 ₽; 3 договора не распределены.
 * НИКАКИХ клиентских имён, телефонов, ID сделок, токенов и webhook URL.
 */
window.BV_MANAGERS = Object.freeze({
  month:"Сентябрь 2026",
  company:{
    incoming:222,qualified:122,excluded:100,
    contracts:13,revenue:5643000,marginRub:1240000,
    attributedContracts:10,attributedRevenue:4318000,
    unattributedContracts:3,unattributedRevenue:1325000
  },
  sources:[
    {id:"avito",title:"Авито",color:"#2a7852"},
    {id:"vk",title:"ВКонтакте",color:"#ae8659"},
    {id:"calls",title:"Звонки",color:"#d3aa67"},
    {id:"other",title:"Прочие",color:"#93a59a"}
  ],
  managers:[
    {
      id:"german",name:"Герман Рожнев",role:"Менеджер",initials:"ГР",
      incoming:{avito:71,vk:2,calls:25,other:2},
      qualified:{avito:49,vk:1,calls:2,other:1},
      contractsKnown:{avito:1,vk:1,calls:0,other:0},
      revenueKnown:{avito:400000,vk:475000,calls:0,other:0}
    },
    {
      id:"danil",name:"Данил Шиляев",role:"Менеджер",initials:"ДШ",
      incoming:{avito:66,vk:7,calls:1,other:0},
      qualified:{avito:45,vk:5,calls:1,other:0},
      contractsKnown:{avito:5,vk:1,calls:0,other:0},
      revenueKnown:{avito:1943000,vk:447000,calls:0,other:0}
    },
    {
      id:"ilya",name:"Илья Блинов",role:"В CRM: Ilya Blinov",initials:"ИБ",
      incoming:{avito:30,vk:12,calls:3,other:2},
      qualified:{avito:13,vk:0,calls:3,other:1},
      contractsKnown:{avito:1,vk:0,calls:1,other:0},
      revenueKnown:{avito:496000,vk:0,calls:557000,other:0}
    },
    {
      id:"mikhail",name:"Михаил Русинов",role:"РОП · в CRM: Русинов Михаил Андреевич",initials:"МР",
      incoming:{avito:0,vk:0,calls:0,other:1},
      qualified:{avito:0,vk:0,calls:0,other:1},
      contractsKnown:{avito:0,vk:0,calls:0,other:0},
      revenueKnown:{avito:0,vk:0,calls:0,other:0}
    }
  ],
  // Источники дополнительных 3 договоров известны; их сотрудники и суммы по источникам — нет.
  additionalContracts:{avito:1,vk:1,calls:1,other:0},
  marginPlans:[
    {name:"Ответственный не указан",amount:500000,note:"Требуется сопоставить с сотрудником CRM"},
    {name:"Илья",amount:300000,note:"Проверить соответствие Илье Блинову"},
    {name:"Михаил",amount:200000,note:"Проверить соответствие Михаилу Русинову"}
  ]
});
