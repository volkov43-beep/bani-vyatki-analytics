/*
 * Bani Vyatki Analytics · Цикл продажи, сентябрь 2026.
 * 13 договоров / 5 643 000 ₽. Даты первых обращений:
 *  - 10: маркетинговый отчёт за сентябрь 2026, раздел 8;
 *  - 3: дата СОЗДАНИЯ СДЕЛКИ в выгрузке Битрикс24 (сверена по
 *       сумме, менеджеру, источнику, дате подписания).
 * Дата создания сделки CRM может отличаться от первого реального
 * контакта, поэтому "crm_created" отмечаем отдельно.
 * В публичный GitHub не загружаем имена/телефоны клиентов и ID сделок.
 * Договоры и цены берутся из managers-data.js; ключ сопоставления:
 * дата договора + менеджер + источник + сумма.
 */
window.BV_CYCLE_INPUT = Object.freeze({
  period:"Сентябрь 2026",
  knownStarts:[
    {date:"02.09",manager:"german",source:"avito",revenue:510000,firstInquiry:"24.08.2026",basis:"crm_created"},
    {date:"04.09",manager:"ilya",source:"calls",revenue:452000,firstInquiry:"04.09.2026",basis:"crm_created"},
    {date:"05.09",manager:"ilya",source:"vk",revenue:363000,firstInquiry:"13.08.2026",basis:"crm_created"},
    {date:"16.09",manager:"danil",source:"avito",revenue:294000,firstInquiry:"14.09.2026",basis:"report"},
    {date:"17.09",manager:"danil",source:"vk",revenue:447000,firstInquiry:"15.09.2026",basis:"report"},
    {date:"18.09",manager:"german",source:"vk",revenue:475000,firstInquiry:"31.08.2026",basis:"report"},
    {date:"19.09",manager:"danil",source:"avito",revenue:293000,firstInquiry:"13.09.2026",basis:"report"},
    {date:"19.09",manager:"danil",source:"avito",revenue:400000,firstInquiry:"02.09.2026",basis:"report"},
    {date:"21.09",manager:"danil",source:"avito",revenue:370000,firstInquiry:"10.09.2026",basis:"report"},
    {date:"21.09",manager:"german",source:"avito",revenue:400000,firstInquiry:"15.09.2026",basis:"report"},
    {date:"23.09",manager:"ilya",source:"calls",revenue:557000,firstInquiry:"21.09.2026",basis:"report"},
    {date:"23.09",manager:"danil",source:"avito",revenue:586000,firstInquiry:"10.08.2026",basis:"report"},
    {date:"24.09",manager:"ilya",source:"avito",revenue:496000,firstInquiry:"14.09.2026",basis:"report"}
  ],
  prior:{
    period:"Июль–август 2026",
    count:13,average:7,median:4,quickShare:85,
    note:"Агрегат из раздела 9 исходного маркетингового отчёта; индивидуальные даты этих 13 договоров пока не загружены."
  },
  boundaries:{quickMax:7,middleMax:30}
});