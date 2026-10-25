---
name: brujula-macros
description: Convierte lo que el usuario ha comido (texto suelto, lista de alimentos, foto de un plato o etiqueta) en el JSON de importación de Brújula, su app personal de hábitos y nutrición, listo para pegar en «Nutrición → Importar desde ChatGPT». Usa esta skill siempre que el usuario mencione Brújula junto a comida, pida "los macros en JSON", "mete esto en Brújula", "calcula las calorías de…", "qué he comido hoy", describa un desayuno, comida, merienda o cena, o envíe una foto de comida para registrarla, aunque no diga la palabra JSON.
---

# Macros en JSON para Brújula

Brújula importa comidas desde un único objeto JSON con `schema_version: 1`. La app
valida el documento entero antes de guardar nada: un solo campo mal escrito rechaza
toda la importación con un mensaje de error, así que la forma importa tanto como las
cifras. Esta skill te da el esquema exacto, cómo estimar y cómo presentar el resultado.

## Qué devolver

1. Dos a cinco líneas con las suposiciones que hayas hecho (ración asumida, aceite
   contado o no, fecha elegida). El usuario corrige esas líneas, no el JSON.
2. Un solo bloque ```json con el documento completo. Nada después del bloque.

Si el usuario describe varios días, devuelve un bloque por día en orden cronológico:
cada JSON lleva una única `date` y Brújula importa un día por vez.

## Esquema exacto

```json
{
  "schema_version": 1,
  "date": "2026-10-25",
  "meals": [
    {
      "type": "lunch",
      "name": "Pollo a la plancha",
      "quantity": 150,
      "unit": "g",
      "calories": 1.65,
      "protein": 0.31,
      "carbs": 0,
      "fat": 0.036,
      "fiber": 0,
      "sugars": 0,
      "saturated_fat": 0.01,
      "salt": 0.001
    }
  ]
}
```

Reglas que la app comprueba, en este orden:

- `schema_version` es exactamente el número `1`.
- `date` es `AAAA-MM-DD` y una fecha real. Usa la fecha local del usuario (España,
  Europa/Madrid). Si dice «ayer» o «el martes», calcula la fecha; si no dice nada,
  es hoy. Nunca inventes una fecha futura.
- `meals` tiene entre 1 y 100 comidas. El texto completo no debe superar 100 KB.
- `type` es uno de: `breakfast`, `mid_morning`, `lunch`, `snack`, `dinner`, `other`.
- `name`: 1–200 caracteres, en español, corto y reconocible («Tostada con tomate y
  aceite», no «Tostada»). Es lo que el usuario verá en la lista.
- `calories`, `protein`, `carbs`, `fat`: obligatorios, números entre 0 y 100000.
- `quantity`: opcional, mayor que 0 (por defecto 1). `unit`: opcional, una de
  `unit`, `serving`, `cup`, `glass`, `package`, `g`, `ml` (por defecto `unit`).
- Opcionales y en gramos: `fiber`, `sugars`, `saturated_fat`, `trans_fat`, `salt`.
  Opcionales en miligramos: `cholesterol`, `sodium`, `potassium`, `vitamin_c`,
  `calcium`, `iron`. `vitamin_a` en microgramos. Si no los conoces, omítelos; no
  pongas ceros de relleno.
- Cualquier clave distinta de las anteriores sobra: la app las ignora, pero
  confunden al usuario. Nada de comentarios ni de números con coma decimal.

## Los nutrientes son por unidad, no totales

Brújula multiplica cada nutriente por `quantity`. Esta es la trampa habitual:

- Si usas `unit: "g"` o `"ml"`, los valores son **por gramo** o por mililitro
  (150 g de pollo → `calories: 1.65`, no 247). Redondea a tres decimales. Esta forma
  es la mejor cuando el usuario da pesos: después puede cambiar la cantidad en la app
  y todo se recalcula.
- Si usas `unit: "unit"` (huevo, plátano, yogur, rebanada), los valores son por pieza
  y `quantity` el número de piezas.
- Si usas `unit: "serving"`, `cup`, `glass` o `package`, los valores son por ración,
  taza, vaso o envase. Un plato combinado sin pesos va como una ración con sus
  totales.

Comprueba la coherencia antes de responder: `calories` debería estar cerca de
`4·protein + 4·carbs + 9·fat` (±15 %; el alcohol y la fibra explican desvíos
mayores). Si no cuadra, revisa la estimación, no fuerces las calorías.

## Cómo estimar

- Separa los componentes que el usuario querrá corregir por separado (el pan, el
  aceite, la fruta) y agrupa lo que no (el sofrito dentro de unas lentejas).
- Raciones españolas habituales: rebanada de pan 30 g, tostada grande 60 g, plato de
  legumbre cocinada 300 g, plato de pasta cocida 250 g, filete 150 g, cucharada de
  aceite 10 g, vaso de leche 200 ml, caña 200 ml, copa de vino 150 ml. Cuando dudes
  entre dos raciones, elige la mayor y dilo en las suposiciones: subestimar es el
  error más común al registrar.
- El aceite de cocinar cuenta: añade 5–10 g por plato salteado, a la plancha o
  frito si el usuario no lo menciona, y dilo.
- Para el tipo de comida sin indicación: antes de las 11 h desayuno, 11–13 h media
  mañana, 13–16 h comida, 16–20 h merienda, después cena. Picoteo entre horas o
  bebidas sueltas: `other`.
- Las cifras por 100 g de los alimentos más frecuentes están en
  `references/alimentos.md`; úsalas antes que la memoria para que el registro sea
  consistente de un día a otro. Para marcas concretas o etiquetas fotografiadas,
  copia la etiqueta.
- Con una foto, describe en las suposiciones qué ves y el tamaño del plato que
  asumes. Prefiere pocos componentes grandes a muchos pequeños adivinados.

## Validar antes de entregar

Si dispones de un entorno donde ejecutar Python, pasa el documento por
`scripts/validate.py` (lee el JSON de un fichero o de la entrada estándar). Aplica
las mismas reglas que la app, avisa de calorías incoherentes y de valores por
gramo que parecen totales, e imprime el resumen del día. Si no puedes ejecutarlo,
repasa la lista de reglas de arriba a mano.

## Después de importar

Importar dos veces el mismo JSON no duplica comidas: Brújula reconoce el contenido.
Pero un JSON corregido es un documento nuevo y se añadiría a lo ya importado. Si el
usuario quiere rectificar algo ya guardado, dile que edite o borre la comida en la
app, o que importe solo las comidas que faltan.

## Ejemplo

Usuario: «hoy desayuné dos tostadas con tomate y aceite y un café con leche, y de
comer lentejas con chorizo y una manzana. métemelo en brújula»

Respuesta:

Suposiciones: tostadas de 30 g cada una con 10 g de aceite en total; café con 100 ml
de leche semidesnatada sin azúcar; plato de lentejas con chorizo de 350 g cocinado;
manzana mediana de 180 g. Fecha: hoy.

```json
{
  "schema_version": 1,
  "date": "2026-10-25",
  "meals": [
    { "type": "breakfast", "name": "Tostada con tomate y aceite", "quantity": 2, "unit": "unit", "calories": 125, "protein": 2.7, "carbs": 15.5, "fat": 5.6, "fiber": 1.2, "sugars": 1.2, "saturated_fat": 0.9, "salt": 0.4 },
    { "type": "breakfast", "name": "Café con leche semidesnatada", "quantity": 1, "unit": "cup", "calories": 46, "protein": 3.3, "carbs": 4.8, "fat": 1.6, "sugars": 4.8, "saturated_fat": 1 },
    { "type": "lunch", "name": "Lentejas con chorizo", "quantity": 350, "unit": "g", "calories": 1.25, "protein": 0.072, "carbs": 0.14, "fat": 0.045, "fiber": 0.045, "saturated_fat": 0.016, "salt": 0.006 },
    { "type": "lunch", "name": "Manzana", "quantity": 180, "unit": "g", "calories": 0.52, "protein": 0.003, "carbs": 0.12, "fat": 0.002, "fiber": 0.02, "sugars": 0.10 }
  ]
}
```
