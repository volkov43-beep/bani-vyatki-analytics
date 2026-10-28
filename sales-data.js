/* Агрегаты Битрикс24 и отчёта за сентябрь 2026. Персональных данных нет.
 * 222 обращения — когорта по дате создания в сентябре.
 * 13 договоров — продажи по дате заключения в сентябре, независимо от месяца обращения.
 * counts в stageGroups — текущие стадии сентябрьской когорты в экспортированном снимке CRM.
 */
window.BV_SALES = Object.freeze({
 period:"Сентябрь 2026",
 summary:{contracts:13,revenue:5643000,averageCheck:434076,tours:47,priorContracts:7,priorRevenue:3642900,priorTours:43,priorAverageCheck:520414,avitoTours:38,cohort:222,qualified:122},
 monthly:[
  {label:"Июн",name:"Июнь",contracts:10,revenue:4540000},
  {label:"Июл",name:"Июль",contracts:12,revenue:6500000},
  {label:"Авг",name:"Август",contracts:7,revenue:3642900},
  {label:"Сен",name:"Сентябрь",contracts:13,revenue:5643000}
 ],
 sources:[
  {id:"avito",name:"Авито",deals:8,cohort:167,color:"#266a4a"},
  {id:"vk",name:"ВКонтакте",deals:3,cohort:21,color:"#ae8054"},
  {id:"calls",name:"Входящие звонки",deals:2,cohort:29,color:"#d3a057"},
  {id:"other",name:"Прочие",deals:0,cohort:5,color:"#a8b1a5"}
 ],
 stageGroups:[
  {id:"new",title:"Новая заявка",detail:"Новая заявка получена",counts:[34,1,0,0],color:"#2c7250",kind:"active"},
  {id:"qualification",title:"Квалификация",detail:"Взят в работу/квалификация",counts:[33,2,1,1],color:"#559373",kind:"active"},
  {id:"waiting",title:"Ожидание",detail:"Ожидание чего-то",counts:[7,0,0,1],color:"#9aa984",kind:"active"},
  {id:"invited",title:"Приглашён на КЭВ",detail:"Приглашен на КЭВ",counts:[8,0,0,0],color:"#ad9b71",kind:"active"},
  {id:"met",title:"КЭВ проведён",detail:"КЭВ проведен",counts:[10,0,1,0],color:"#c59c5f",kind:"active"},
  {id:"contract",title:"Договор и аванс",detail:"Договор+аванс получен+ТЗ на Производство",counts:[4,2,3,0],color:"#c88c48",kind:"active"},
  {id:"lost",title:"Отказы и разбор потерь",detail:"Купили у конкурентов / Сделка провалена / Дорого / Анализ причины провала",counts:[11,1,1,1],color:"#ad765e",kind:"lost"},
  {id:"excluded",title:"Без диалога / спам",detail:"Игнорит / Спам.Различные предложения / не ответили после рассылки",counts:[60,15,23,2],color:"#bdc1b7",kind:"excluded"}
 ],
 reasons:[
  {title:"Игнорит",counts:[50,2,0,0],type:"excluded"},
  {title:"Спам / рекламные предложения",counts:[2,13,23,2],type:"excluded"},
  {title:"Нет ответа после рассылки",counts:[8,0,0,0],type:"excluded"},
  {title:"Купили у конкурентов",counts:[6,0,0,0],type:"lost"},
  {title:"Сделка провалена",counts:[3,0,0,1],type:"lost"},
  {title:"Дорого",counts:[2,0,1,0],type:"lost"},
  {title:"Анализ причины провала",counts:[0,1,0,0],type:"lost"}
 ]
});
