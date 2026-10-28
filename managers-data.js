/*
 * Bani Vyatki Analytics · Сентябрь 2026
 * Только агрегаты и обезличенные договоры для публичного тестового дашборда.
 *
 * 222 обращения: из выгрузки CRM за сентябрь, ответственный на дату среза.
 * 13 договоров / 5 643 000 ₽: 10 договоров из исходного маркетингового
 * отчёта + 3 уточнённых 28.10.2026 (02.09, 04.09, 05.09).
 * Маржа по каждой сделке НЕ предоставлена: null, не 0.
 *
 * В GitHub нет имён/контактов покупателей, ID карточек CRM или вебхуков.
 * В массиве deals не хранятся имена покупателей: даты, канал, менеджер,
 * сумма заключённого договора и пока пустое поле marginRub.
 */
window.BV_MANAGERS = Object.freeze({
  month:"Сентябрь 2026",
  company:{
    incoming:222,qualified:122,excluded:100,
    contracts:13,revenue:5643000,marginRub:1240000
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
      qualified:{avito:49,vk:1,calls:2,other:1}
    },
    {
      id:"danil",name:"Данил Шиляев",role:"Менеджер",initials:"ДШ",
      incoming:{avito:66,vk:7,calls:1,other:0},
      qualified:{avito:45,vk:5,calls:1,other:0}
    },
    {
      id:"ilya",name:"Илья Блинов",role:"В CRM: Ilya Blinov",initials:"ИБ",
      incoming:{avito:30,vk:12,calls:3,other:2},
      qualified:{avito:13,vk:0,calls:3,other:1}
    },
    {
      id:"mikhail",name:"Михаил Русинов",role:"РОП · в CRM: Русинов Михаил Андреевич",initials:"МР",
      incoming:{avito:0,vk:0,calls:0,other:1},
      qualified:{avito:0,vk:0,calls:0,other:1}
    }
  ],
  // Анонимизированные строки 13 продаж; последовательность не является ID CRM.
  deals:[
    {date:"02.09",manager:"german",source:"avito",revenue:510000,marginRub:null},
    {date:"04.09",manager:"ilya",source:"calls",revenue:452000,marginRub:null},
    {date:"05.09",manager:"ilya",source:"vk",revenue:363000,marginRub:null},
    {date:"16.09",manager:"danil",source:"avito",revenue:294000,marginRub:null},
    {date:"17.09",manager:"danil",source:"vk",revenue:447000,marginRub:null},
    {date:"18.09",manager:"german",source:"vk",revenue:475000,marginRub:null},
    {date:"19.09",manager:"danil",source:"avito",revenue:293000,marginRub:null},
    {date:"19.09",manager:"danil",source:"avito",revenue:400000,marginRub:null},
    {date:"21.09",manager:"danil",source:"avito",revenue:370000,marginRub:null},
    {date:"21.09",manager:"german",source:"avito",revenue:400000,marginRub:null},
    {date:"23.09",manager:"ilya",source:"calls",revenue:557000,marginRub:null},
    {date:"23.09",manager:"danil",source:"avito",revenue:586000,marginRub:null},
    {date:"24.09",manager:"ilya",source:"avito",revenue:496000,marginRub:null}
  ],
  // Планы по марже из сообщений пользователя. Привязка уточняется отдельно.
  marginPlans:[
    {name:"Ответственный не указан",amount:500000,note:"Требуется сопоставить с сотрудником CRM"},
    {name:"Илья",amount:300000,note:"Проверить соответствие Илье Блинову"},
    {name:"Михаил",amount:200000,note:"Проверить соответствие Михаилу Русинову"}
  ]
});