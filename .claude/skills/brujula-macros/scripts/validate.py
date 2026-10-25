#!/usr/bin/env python3
"""Valida un JSON de importación de Brújula con las mismas reglas que la app.

Uso: python validate.py comida.json   |   cat comida.json | python validate.py
Sale con código 1 si la app rechazaría el documento. Los avisos no bloquean.
"""
import json
import sys
from datetime import date

TYPES = {"breakfast", "mid_morning", "lunch", "snack", "dinner", "other"}
UNITS = {"unit", "serving", "cup", "glass", "package", "g", "ml"}
MACROS = ["calories", "protein", "carbs", "fat"]
DETAILS = ["fiber", "sugars", "saturated_fat", "trans_fat", "cholesterol", "sodium", "potassium", "vitamin_a", "vitamin_c", "calcium", "iron", "salt"]


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == value and abs(value) != float("inf")


def main() -> int:
    raw = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.read()
    errors, warnings = [], []
    if len(raw) > 100000:
        errors.append("El JSON supera los 100 KB.")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as cause:
        print(f"ERROR: JSON no válido: {cause}")
        return 1
    if not isinstance(data, dict):
        print("ERROR: el documento debe ser un objeto.")
        return 1
    if data.get("schema_version") != 1 or isinstance(data.get("schema_version"), bool):
        errors.append("schema_version debe ser el número 1.")
    try:
        when = date.fromisoformat(str(data.get("date")))
        if when > date.today():
            warnings.append(f"La fecha {when} es futura.")
    except ValueError:
        errors.append("date debe ser una fecha real con formato AAAA-MM-DD.")
    meals = data.get("meals")
    if not isinstance(meals, list) or not 1 <= len(meals) <= 100:
        errors.append("meals debe ser una lista de entre 1 y 100 comidas.")
        meals = []
    totals = {key: 0.0 for key in MACROS}
    for index, meal in enumerate(meals, start=1):
        prefix = f"Comida {index}"
        if not isinstance(meal, dict):
            errors.append(f"{prefix}: debe ser un objeto.")
            continue
        name = meal.get("name")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 200:
            errors.append(f"{prefix}: name debe tener entre 1 y 200 caracteres.")
        if meal.get("type") not in TYPES:
            errors.append(f"{prefix}: type no válido ({meal.get('type')!r}).")
        for key in MACROS:
            value = meal.get(key)
            if not number(value) or value < 0 or value > 100000:
                errors.append(f"{prefix}: {key} debe ser un número entre 0 y 100000.")
        for key in DETAILS:
            if key in meal and (not number(meal[key]) or meal[key] < 0 or meal[key] > 100000):
                errors.append(f"{prefix}: {key} debe ser un número entre 0 y 100000.")
        quantity = meal.get("quantity", 1)
        if not number(quantity) or quantity <= 0 or quantity > 100000:
            errors.append(f"{prefix}: quantity debe ser mayor que 0.")
            quantity = 1
        unit = meal.get("unit", "unit")
        if unit not in UNITS:
            errors.append(f"{prefix}: unit no válida ({unit!r}).")
        extra = set(meal) - set(MACROS) - set(DETAILS) - {"type", "name", "quantity", "unit"}
        if extra:
            warnings.append(f"{prefix}: claves que la app ignora: {', '.join(sorted(extra))}.")
        if all(number(meal.get(key)) for key in MACROS):
            calories, protein, carbs, fat = (meal[key] for key in MACROS)
            expected = 4 * protein + 4 * carbs + 9 * fat
            if expected and abs(calories - expected) / expected > 0.15:
                warnings.append(f"{prefix}: {calories} kcal no cuadra con los macros (≈{expected:.1f}).")
            if unit in {"g", "ml"} and calories > 9.5:
                warnings.append(f"{prefix}: {calories} kcal por {unit} parece un total, no un valor por {unit}.")
            for key in MACROS:
                totals[key] += meal[key] * quantity
    for message in errors:
        print(f"ERROR: {message}")
    for message in warnings:
        print(f"AVISO: {message}")
    if not errors:
        print(f"OK · {len(meals)} comidas · {totals['calories']:.0f} kcal · P {totals['protein']:.0f} g · C {totals['carbs']:.0f} g · G {totals['fat']:.0f} g")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
