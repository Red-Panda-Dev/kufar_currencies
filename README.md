# Kufar.by Валюты

Расширение заменяет видимые цены в BYN на Kufar на выбранную валюту: `USD`, `EUR` или `RUB`.

## Что поддерживается в MVP

- Поддерживаемый домен: `auto.kufar.by`.
- Переключатель `везде / kufar.by` в popup включает все активные домены; будущие домены остаются отключенными.
- Будущие домены (`re`, `travel`, `kufar.by`) показаны в popup как отключенные.
- Валюта выбора общая для всех доменов: `selectedCurrency`.

## Курсы и кэш

- Источник курсов: НБРБ `https://api.nbrb.by/exrates/rates?periodicity=0`.
- Сеть использует только `background.js`.
- При ошибке запроса кэш `ratesData` не удаляется; сохраняется `lastError`.

## Popup

- Показывает кешированные курсы.
- Позволяет выбрать валюту отображения.
- Содержит конвертер BYN -> выбранная в конвертере валюта.
- Позволяет обновить курсы кнопкой.
- Показывает переключатели доменов Kufar.

## Privacy

Расширение не собирает пользовательские данные. Оно запрашивает только публичные курсы НБРБ и локально меняет текст цен в DOM страниц Kufar.

## Development commands

- `npm install`
- `npm test`
- `npx vitest run tests/parse.test.js`
- `npx vitest run tests/content.test.js`
- `npm run format:check`
- `npm run build:chrome`

## Firefox ID

Используется Gecko ID: `kufar-by-currencies@redpandadev`.
