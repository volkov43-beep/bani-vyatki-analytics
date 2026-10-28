/* Цикл продажи, сентябрь 2026.
 * В этом файле только известные даты ПЕРВОГО обращения для 10 договоров
 * из исходного сентябрьского маркетингового отчёта (разделы 8 и 9).
 * Даты и суммы самих 13 договоров хранятся в managers-data.js.
 * Для трёх дополненных договоров (02, 04 и 05 сентября) даты первых
 * обращений пока НЕИЗВЕСТНЫ. Не подставляем в расчёт дату договора.
 * Клиентские имена и персональные данные в публичную демоверсию не включаем.
 */
window.BV_CYCLE_INPUT = Object.freeze({
  period:"Сентябрь 2026",
  knownStarts:[
    {date:"16.09",manager:"danil",source:"avito",revenue:294000,firstInquiry:"14.09.2026"},
    {date:"17.09",manager:"danil",source:"vk",revenue:447000,firstInquiry:"15.09.2026"},
    {date:"18.09",manager:"german",source:"vk",revenue:475000,firstInquiry:"31.08.2026"},
    {date:"19.09",manager:"danil",source:"avito",revenue:293000,firstInquiry:"13.09.2026"},
    {date:"19.09",manager:"danil",source:"avito",revenue:400000,firstInquiry:"02.09.2026"},
    {date:"21.09",manager:"danil",source:"avito",revenue:370000,firstInquiry:"10.09.2026"},
    {date:"21.09",manager:"german",source:"avito",revenue:400000,firstInquiry:"15.09.2026"},
    {date:"23.09",manager:"ilya",source:"calls",revenue:557000,firstInquiry:"21.09.2026"},
    {date:"23.09",manager:"danil",source:"avito",revenue:586000,firstInquiry:"10.08.2026"},
    {date:"24.09",manager:"ilya",source:"avito",revenue:496000,firstInquiry:"14.09.2026"}
  ],
  prior:{
    period:"Июль–август 2026",
    count:13,average:7,median:4,
    quickShare:85,
    note:"Исторический агрегат из раздела 9 сентябрьского отчёта. Индивидуальные даты этих 13 договоров пока не загружены."
  },
  boundaries:{
    quickMax:7,
    middleMax:30
  }
});