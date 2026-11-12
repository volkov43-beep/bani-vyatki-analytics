#!/usr/bin/env python3
"""Раздел 07 «Авито»: собирает avito-data.js из дневных выгрузок Avito Pro.

Вход:
  --exports DIR   папка с выгрузками «Статистика объявлений», ОДИН файл = ОДИН день
                  (дата берётся из конца имени файла: …ГГГГ-ММ-ДД.xlsx или …ГГГГ-ММ-ДД_1.xlsx);
  --listings CSV  справочник объявлений data/avito-listings.csv.
Выход: avito-data.js — только агрегаты по дням и объявлениям.

Исходные выгрузки в репозиторий НЕ кладутся. Номера объявлений в выгрузке Avito Pro пустые,
поэтому объявление определяется по городу, адресу, категории, цене и дате первой публикации.
Объявление, которого нет в справочнике, останавливает сборку: его нужно добавить в CSV.
  --base JS       (необязательно) уже опубликованный avito-data.js: его дни сохраняются, из --exports
                  берутся только следующие дни — так еженедельное обновление не требует старых выгрузок.
Требуется: pandas, openpyxl.
Пример: python3 scripts/build-avito-data.py --exports ~/avito --listings data/avito-listings.csv --out avito-data.js
Дописать новые дни: python3 scripts/build-avito-data.py --base avito-data.js --exports ~/avito-new \
                    --listings data/avito-listings.csv --out avito-data.js
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
FIELDS = ["day", "listing", "shows", "views", "contacts", "chat", "phone", "phoneAndChat", "discountReplies",
          "favorites", "spendMoney", "spendPromo", "spendBonus", "listingsInRow"]
DATE_RE = re.compile(r"(?<!\d)(\d{4}-\d{2}-\d{2})(?:_\d+)?\.xlsx$")


def category(row) -> str:
    if row["Категория"] == "Услуги":
        return "Услуги"
    return {"Купели, чаны, бочки": "Чан"}.get(row["Параметр"], "Баня")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--exports", required=True)
    ap.add_argument("--listings", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--updated", default=dt.date.today().isoformat())
    ap.add_argument("--base", help="готовый avito-data.js: его дни сохраняются, из --exports добавляются только новые дни")
    a = ap.parse_args()

    # справочник: одинаковые ключи у двух строк = «близнецы», выгрузка их не различает
    listings, index = [], {}
    for r in csv.DictReader(open(a.listings, encoding="utf-8"), delimiter=";"):
        key = (r["Город"], r["Адрес"], r["Категория"], int(r["Цена"]), r["Дата первой публикации"])
        title = r["Название"] if r["Статус"] == "ok" and r["Название"] else None
        if key in index:
            l = listings[index[key]]
            if l["id"] != r["id"]:
                raise SystemExit(f"Разные id у одинаковых объявлений: {key}")
            l["titles"].append(title); l["pair"] = True; l["title"] = None
            continue
        index[key] = len(listings)
        listings.append({"id": r["id"], "titles": [title], "title": title, "city": r["Город"], "address": r["Адрес"],
                         "category": r["Категория"], "price": key[3], "published": key[4], "pair": False})

    files = {}
    for f in sorted(Path(a.exports).glob("*.xlsx")):
        m = DATE_RE.search(f.name)
        if not m or re.search(r"\d{4}-\d{2}-\d{2}_+\d{4}-\d{2}-\d{2}", f.name):
            continue  # пропускаем выгрузки за период (две даты в имени)
        if m.group(1) in files:
            raise SystemExit(f"Два файла за {m.group(1)}: {files[m.group(1)].name}, {f.name}")
        files[m.group(1)] = f

    # --base: дописываем новые дни к уже опубликованным данным (старые выгрузки не нужны)
    dates, rows = [], []
    if a.base:
        text = Path(a.base).read_text(encoding="utf-8")
        base = json.loads(text[text.index("Object.freeze(") + len("Object.freeze("):text.rindex(");")])
        old_ids = [l["id"] for l in base["listings"]]
        if old_ids != [l["id"] for l in listings[:len(old_ids)]]:
            raise SystemExit("Справочник не совпадает с --base: новые объявления добавляются только в конец CSV")
        overlap = sorted(set(files) & set(base["dates"]))
        if overlap:
            raise SystemExit(f"Дни уже есть в {a.base}: {', '.join(overlap)} — уберите эти файлы из папки")
        dates, rows = list(base["dates"]), [list(r) for r in base["rows"]]
    new_dates = sorted(files)
    if dates and new_dates and new_dates[0] <= dates[-1]:
        raise SystemExit(f"Новые дни ({new_dates[0]}) должны идти после последнего дня в --base ({dates[-1]})")
    for d in new_dates:
        di = len(dates)
        dates.append(d)
        df = pd.read_excel(files[d])
        df.columns = [c.replace("\xa0", " ") for c in df.columns]
        acc = defaultdict(lambda: [0] * 12)
        for _, x in df.iterrows():
            key = (x["Город"], x["Адрес"], category(x), int(re.sub(r"\D", "", str(x["Цена"]))), str(x["Дата первой публикации"])[:10])
            if key not in index:
                raise SystemExit(f"Нет в справочнике {a.listings}: {key} (файл за {d})")
            vals = [int(x["Показы"]), int(x["Просмотры"]), int(x["Контакты"]), int(x["Написали в чат"]),
                    int(x["Посмотрели телефон"]), int(x["Посмотрели телефон и написали в чат"]),
                    int(x["Откликнулись на скидку в чате"]), int(x["Добавили в избранное"]),
                    round(float(x["Расходы на объявления"]), 2), round(float(x["Расходы на продвижение"]), 2),
                    round(float(x["Списано бонусов на объявления"]), 2), 1]
            cell = acc[index[key]]
            for i, v in enumerate(vals):
                cell[i] = round(cell[i] + v, 2)
        for li, cell in sorted(acc.items()):
            cell[11] = int(cell[11])
            rows.append([di, li] + cell)

    days = [dt.date.fromisoformat(d) for d in dates]
    gaps = [str(x + dt.timedelta(1)) for x, y in zip(days, days[1:]) if (y - x).days != 1]
    if gaps:
        raise SystemExit(f"Пропуск дней после: {', '.join(gaps)} — нужна выгрузка за каждый день")

    months = []
    for mid in sorted({d[:7] for d in dates}):
        loaded = [d for d in dates if d.startswith(mid)]
        total = pd.Period(mid).days_in_month
        name = MONTHS[int(mid[5:]) - 1]
        months.append({"id": mid, "name": name, "label": name[:3], "days": total, "loadedDays": len(loaded),
                       "from": loaded[0], "to": loaded[-1], "complete": len(loaded) == total})

    data = {"source": "Avito Pro → Статистика объявлений, отдельная выгрузка за каждый день", "updated": a.updated,
            "fields": FIELDS, "dates": dates, "months": months,
            "listings": listings, "rows": rows}
    header = ("/* Раздел 07 «Авито: объявления». Агрегаты дневных выгрузок Avito Pro «Статистика объявлений».\n"
              " * Сгенерировано scripts/build-avito-data.py — не править вручную. Справочник объявлений: data/avito-listings.csv.\n"
              " * Персональных данных нет: только итоги по дням и объявлениям компании (название, адрес точки продаж, цена).\n"
              " * rows: одна строка = одно объявление за один день; порядок полей — в fields.\n"
              " * Данные Авито НЕ входят в общие итоги дашборда: обращения и продажи считаются в CRM (разделы 01–05).\n"
              " * title: null — название уточняется. pair: true — два объявления с одинаковыми адресом, ценой и датой\n"
              " * публикации; выгрузка их не различает, поэтому они показываются одной строкой.\n */\n")
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    body = body.replace(',"rows":[[', ',\n"rows":[\n[').replace("],[", "],\n[")
    body = body.replace(',"listings":[{', ',\n"listings":[\n{').replace('},{"id"', '},\n{"id"')
    Path(a.out).write_text(header + "window.BV_AVITO = Object.freeze(" + body + ");\n", encoding="utf-8")
    print(f"{len(dates)} дн. ({dates[0]} … {dates[-1]}), объявлений {len(listings)}, строк {len(rows)}")
    for m in months:
        print(f"  {m['name']} {m['id'][:4]}: {m['loadedDays']} из {m['days']} дн.")


if __name__ == "__main__":
    main()
