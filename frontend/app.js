const providers = {
  openai: {
    name: "OpenAI",
    short: "OA",
    color: "#313a4c",
    gradient: "linear-gradient(135deg,#263042,#778299)",
    description: "ChatGPT subscription identity and Codex remote usage",
    primaryProduct: "codex",
    products: {}
  },
  volcengine: {
    name: "Volcengine Ark",
    short: "Ark",
    color: "#4c72f4",
    gradient: "linear-gradient(135deg,#3d7bff,#6d56e8)",
    description: "Separates Agent Plan, Coding Plan, and pay-as-you-go API by billing product",
    primaryProduct: "remote",
    products: {}
  },
  mimo: {
    name: "Xiaomi MiMo",
    short: "Mi",
    color: "#ef7c31",
    gradient: "linear-gradient(135deg,#ff9b45,#e75f2b)",
    description: "Read official MiMo model capabilities after connecting an account",
    primaryProduct: "remote",
    products: {}
  },
  deepseek: {
    name: "DeepSeek official",
    short: "DS",
    color: "#26a4d8",
    gradient: "linear-gradient(135deg,#1aa8dc,#3972dc)",
    description: "Official balance lookup; usage history starts after Prismeter connects",
    primaryProduct: "remote",
    products: {}
  },
  kimi: {
    name: "Kimi API",
    short: "Ki",
    color: "#4338ca",
    gradient: "linear-gradient(135deg,#5b4ce8,#a66df4)",
    description: "Official Kimi balance lookup; usage history starts after Prismeter connects",
    primaryProduct: "remote",
    products: {}
  },
  siliconflow: {
    name: "SiliconFlow",
    short: "SF",
    color: "#596ce5",
    gradient: "linear-gradient(135deg,#5666dc,#7f8cf4)",
    description: "Official SiliconFlow balance lookup; usage history starts after Prismeter connects",
    primaryProduct: "remote",
    products: {}
  },
  bailian: {
    name: "Alibaba Cloud Model Studio",
    short: "QW",
    color: "#6c55df",
    gradient: "linear-gradient(135deg,#5d48d6,#a067ed)",
    description: "Official DashScope model discovery; usage reporting remains in Model Studio Console",
    primaryProduct: "remote",
    products: {}
  },
  openrouter: {
    name: "OpenRouter",
    short: "OR",
    color: "#7d5fff",
    gradient: "linear-gradient(135deg,#6d4dff,#9a7fff)",
    description: "Official OpenRouter credit balance and all-time usage; per-model token history is not exposed",
    primaryProduct: "remote",
    products: {}
  }
};

const APP_DEFAULTS = Object.freeze({
  volcengineRegion: "cn-beijing",
  volcengineProject: "default",
  mimoPaygUrl: "https://api.xiaomimimo.com/v1",
  mimoTokenPlanUrl: "https://token-plan-cn.xiaomimimo.com/v1"
});
const SYNC_POLL_INTERVAL_MS = 900;
const RELATIVE_TIME_REFRESH_MS = 60_000;
const BACKGROUND_STATE_REFRESH_MS = 60_000;

const platformLogoSources = {"openai":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMwMDgwRjciLz4KPHBhdGggZD0iTTkuOTQ0OTQgOS41OTE2M1Y4LjEzMjI3QzkuOTQ0OTQgOC4wMDkzNSA5Ljk5MTA1IDcuOTE3MTMgMTAuMDk4NSA3Ljg1NTc1TDEzLjAzMjcgNi4xNjU5OUMxMy40MzIxIDUuOTM1NTggMTMuOTA4MyA1LjgyODEgMTQuMzk5OCA1LjgyODFDMTYuMjQzMiA1LjgyODEgMTcuNDEwOCA3LjI1Njc3IDE3LjQxMDggOC43Nzc1MUMxNy40MTA4IDguODg1IDE3LjQxMDggOS4wMDc5MiAxNy4zOTUzIDkuMTMwODNMMTQuMzUzNyA3LjM0ODg0QzE0LjE2OTQgNy4yNDEzNSAxMy45ODUgNy4yNDEzNSAxMy44MDA3IDcuMzQ4ODRMOS45NDQ5NCA5LjU5MTYzWk0xNi43OTYzIDE1LjI3NTVWMTEuNzg4M0MxNi43OTYzIDExLjU3MzIgMTYuNzA0IDExLjQxOTYgMTYuNTE5NyAxMS4zMTIxTDEyLjY2NCA5LjA2OTNMMTMuOTIzNiA4LjM0NzI1QzE0LjAzMTEgOC4yODU4NyAxNC4xMjM0IDguMjg1ODcgMTQuMjMwOCA4LjM0NzI1TDE3LjE2NSAxMC4wMzdDMTguMDA5OSAxMC41Mjg3IDE4LjU3ODIgMTEuNTczMiAxOC41NzgyIDEyLjU4N0MxOC41NzgyIDEzLjc1NDQgMTcuODg3IDE0LjgyOTggMTYuNzk2MyAxNS4yNzUzVjE1LjI3NTVaTTkuMDM4NjEgMTIuMjAzMUw3Ljc3ODk2IDExLjQ2NThDNy42NzE0NiAxMS40MDQ1IDcuNjI1MzUgMTEuMzEyMiA3LjYyNTM1IDExLjE4OTNWNy44MDk4QzcuNjI1MzUgNi4xNjYxMyA4Ljg4NTAxIDQuOTIxNzYgMTAuNTkwMiA0LjkyMTc2QzExLjIzNTQgNC45MjE3NiAxMS44MzQ0IDUuMTM2ODkgMTIuMzQxNSA1LjUyMDg5TDkuMzE1MjYgNy4yNzIxOEM5LjEzMDk3IDcuMzc5NjggOS4wMzg3NSA3LjUzMzI4IDkuMDM4NzUgNy43NDg0MVYxMi4yMDMzTDkuMDM4NjEgMTIuMjAzMVpNMTEuNzUgMTMuNzdMOS45NDQ5NCAxMi43NTYyVjEwLjYwNTZMMTEuNzUgOS41OTE3OEwxMy41NTQ5IDEwLjYwNTZWMTIuNzU2MkwxMS43NSAxMy43N1pNMTIuOTA5OCAxOC40NEMxMi4yNjQ1IDE4LjQ0IDExLjY2NTUgMTguMjI0OSAxMS4xNTg1IDE3Ljg0MDlMMTQuMTg0NyAxNi4wODk2QzE0LjM2OSAxNS45ODIxIDE0LjQ2MTIgMTUuODI4NSAxNC40NjEyIDE1LjYxMzRWMTEuMTU4NUwxNS43MzYzIDExLjg5NThDMTUuODQzOCAxMS45NTcyIDE1Ljg4OTkgMTIuMDQ5NCAxNS44ODk5IDEyLjE3MjNWMTUuNTUxOUMxNS44ODk5IDE3LjE5NTUgMTQuNjE0OCAxOC40NCAxMi45MDk4IDE4LjQ0Wk05LjI2OTAxIDE1LjAxNDRMNi4zMzQ4NiAxMy4zMjQ2QzUuNDg5OSAxMi44MzMgNC45MjE2MSAxMS43ODg1IDQuOTIxNjEgMTAuNzc0NkM0LjkyMTYxIDkuNTkxNzcgNS42MjgyNCA4LjUzMTgzIDYuNzE4ODYgOC4wODYzVjExLjU4ODdDNi43MTg4NiAxMS44MDM5IDYuODExMDkgMTEuOTU3NSA2Ljk5NTM4IDEyLjA2NUwxMC44MzU5IDE0LjI5MjNMOS41NzYyMSAxNS4wMTQ0QzkuNDY4NzIgMTUuMDc1OCA5LjM3NjQ5IDE1LjA3NTggOS4yNjkwMSAxNS4wMTQ0Wk05LjEwMDEzIDE3LjUzMzdDNy4zNjQyNiAxNy41MzM3IDYuMDg5MTkgMTYuMjI3OSA2LjA4OTE5IDE0LjYxNDlDNi4wODkxOSAxNC40OTIgNi4xMDQ2IDE0LjM2OTEgNi4xMTk4OCAxNC4yNDYyTDkuMTQ2MSAxNS45OTc1QzkuMzMwMzkgMTYuMTA1IDkuNTE0ODMgMTYuMTA1IDkuNjk5MTIgMTUuOTk3NUwxMy41NTQ5IDEzLjc3MDJWMTUuMjI5NUMxMy41NTQ5IDE1LjM1MjQgMTMuNTA4OCAxNS40NDQ2IDEzLjQwMTMgMTUuNTA2TDEwLjQ2NzEgMTcuMTk1OEMxMC4wNjc3IDE3LjQyNjIgOS41OTE0OCAxNy41MzM3IDkuMDk5OTkgMTcuNTMzN0g5LjEwMDEzWk0xMi45MDk4IDE5LjM2MTZDMTQuNzY4NSAxOS4zNjE2IDE2LjMyIDE4LjA0MDYgMTYuNjczNSAxNi4yODkzQzE4LjM5MzkgMTUuODQzOCAxOS41IDE0LjIzMDggMTkuNSAxMi41ODcyQzE5LjUgMTEuNTExOCAxOS4wMzkxIDEwLjQ2NzMgMTguMjA5NiA5LjcxNDU0QzE4LjI4NjQgOS4zOTE5MiAxOC4zMzI2IDkuMDY5MyAxOC4zMzI2IDguNzQ2ODJDMTguMzMyNiA2LjU1MDE0IDE2LjU1MDUgNC45MDYzNCAxNC40OTIxIDQuOTA2MzRDMTQuMDc3NCA0LjkwNjM0IDEzLjY3NzkgNC45Njc3MiAxMy4yNzg1IDUuMTA2MDVDMTIuNTg3MiA0LjQzMDExIDExLjYzNDcgNCAxMC41OTAyIDRDOC43MzE0IDQgNy4xNzk5NiA1LjMyMTAzIDYuODI2NSA3LjA3MjMyQzUuMTA2MDUgNy41MTc4NiA0IDkuMTMwODMgNCAxMC43NzQ1QzQgMTEuODQ5OCA0LjQ2MDggMTIuODk0NCA1LjI5MDM1IDEzLjY0NzFDNS4yMTM1NCAxMy45Njk3IDUuMTY3NDMgMTQuMjkyMyA1LjE2NzQzIDE0LjYxNDhDNS4xNjc0MyAxNi44MTE0IDYuOTQ5NDEgMTguNDU1MiA5LjAwNzkyIDE4LjQ1NTJDOS40MjI2MSAxOC40NTUyIDkuODIyMDQgMTguMzkzOSAxMC4yMjE1IDE4LjI1NTZDMTAuOTEyNyAxOC45MzE1IDExLjg2NTEgMTkuMzYxNiAxMi45MDk4IDE5LjM2MTZaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K","volcengine":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAA7aSURBVHhe7V0NcBTVHY8iAopSJLuX8KEgHyIiEUJu9y4gM1ZtO5122mmptY62HWfQcRyn8pHbC8gB1hZBqVqrI6gdO7RFED871vqVChQFQUAJ4Edy93bvcrl8JwQhkLx/5//2Nu693N7tkYu5kP3N/CYzu/v27b7/vv/Hb99e8vLORVTABS6FbihQ6FJ+l4NvAYXldI4rACD4aMf4AL2M3++gjyH66V0FqwBcfgCXj97A73fQxxAUurFgDQAaQfDTMn6/g77EVhgi+uknrgcAXKsARB/dwh/ioA8hKnCl4KMnXOUAaATRR78a/ygdwR/noI/g8tNfuFYAiH4AsZwZ4Izgo0X8cQ76CKICawtWA4iKTuaK/PRO/jgHfQRBoe+5VpoMgMYoo0/xxznoAxT4qSD4aINruckAK1k9sDcvAOfzxzvIMkQFbnT5KWW+3zAAGsNHjxf64HL+eAdZhssPitn/M2Ixhkbww0/44x1kGaJCt7Hc32wABQCN4lLog/zxDrKIwgBcJCi0mqWgnAFQFxJ99N98GwdZBApwmPOb/X+3AZhRaHSUAqP5dg6yBLGM3lVgSj8TiEbxU1rgo9fz7RxkCYKPbuwRgM1xgMUGuphv5yAbMAlw/MCbDSD46Ga+qYMswCzA8QNvUDcOPZb3OB3Gt3fQSyQIcEkGn5EZh3a4VtBr+PYOegnRnyjAJSUWZCvxDRn8hm/voJfgBTgrMmFOoU/w7R30AoUByBd8tN4swFmRCXN+utsR5kwQl8ONokLv5rfbRTIBzoq6kWjb+HI6jj/P4EQALhB99POCAMBYhU7jd9tBUgHOinFhzuWjP+LPMyghLKWTRR/tYDn6Mno7v98OrAQ4K+rGogH+PIMSRvqIS0hcCn2M358OqQQ4KzJhzk/f4M81KCEq9GEmFbMMhu7KNDimEuCsGI8D4csC9FL+fIMMcJ6o0Ao2+DgoZbR1zDI6lj8qFVIKcFbUC7IuoYx6+fMNKriWUFH00QY2+BgcywHyy+kP+eNSQfDRZ2wHYIN+AAz6+Qq9jz/foIKg0JuZdhOXDzIOjjYEOCvG+3qBP+Wggkuh/oT1OymCY3Ekki9HIttkVb3X2GZHgLNiXJirzAvAhYk9DSKICt1uTh/jqxeSBkdvOHzL9QDgJoQsqKgYjttsCXBW1OPAqUI/TOf7GhRwLaEXCwoNJqSPKYKjpGnr5p86hQbocIe+mIHbbAlwVsSY88DZ1x4DHgXldK6o0M6E9NEqOAKcJxHyfmlzM3gaGkCOqLfhZrsCnBVZ+uujf0roa7AAtR+WPnLuI/7aMCE4zqupESRCGuTaWig9fhw8tWRd3gIYLpTROjsCnBXjtcdONLC5v0EBl0I3JXMf8eB4xBwcpUjkJikcBjkSAW9jI3jrQm+J/jM3ictoVyYFGM94zGnOL6eFiVd3rmMRDBUVejBp+hgPjgUr6NXG4ZKmKaVtbSCpKsjRKHjqg1UTHu14kp89GfOb2uMHiRd4jkNQ6BRBoV8nTR+N4OijdxjHS6q6rbSlhRlACmvgiYXaJz3bTvKXJmmfIZnL89MViVf4DRYCDCnZs6eA3z6g4VLoLanSx/gyQibMyVQdIWlataeuTjeAqqILgqu2t8GY3/VsmynZl5QKfZW/RgNuVS3ztra2eFT1e/y+AQvRT9cn8//dg4LB0Ud34bGlTdVFbkI65ZqabgN4aglcu7MBhDI8rmf7TIgPgqBQIgRgJH+dLPtS1R0LALDfcyVbMglwSQaEDQoLjtCSl0eHlTaQX3ubmkDStG4DyBECc49GoGAl1Y2Q5By2iW7QR7tc5dTNXynLvkKhhnnt7SAR8t9zIluKC3CNKdNHdE1+gO/cTheUNgXXYeppDL4eBwj7O+GxDhCWJGmfCeO1h6DQe/hrNbIvT309FoCNUlWViz9mwEFYnijAWZF911VOH/I2Bt/BAUgwALqhWAim/CM7cSAuzD3HX6ubED9mX5j+MgaD3+ePGXBwlVO/XmylpqAAjFt3Zr8UIY1yTTipAa55pxFYJtTbOKBnXYcwPTZfq6yqLxnZF0uDCVlu3j8gIfrodqZ6JhkIM/MXA0za1N4pRwiVtMTBZwaoITDnYJTFi97GAZyRmBYLATrFuM6botGLZVUNGtkXM4SmvZx4NwMMrvX0YsFHQ3be3465H+Cq11rBUx/qMfhIOUzAHdRg3MNnQOhtPRCvPVxl9JfGtZYQMtecfXliMZwBZEEs1jNbGigoUGhJDwEuGX3oEgBm7Y6Bpza5AXBW4Cy48vkTkH9/knNkyHgcWGdcawkhd3ubm7uzL4wBbkK6ZFXtkS0NGFgJcDyFZQCFq7pg7ucY/PSMJxmxIJv+RnNWDBAX5iqMa3UTssmQP3SDa8AMoqo9sqUBAysBjqewGODyP59iT7mkWRtAjoagaE9Mb9fLOMDeSyu0cdSv9E+YJEIOovRt7i8eiHtkSwMDi2CooNBDSQU4jphaTn2xDbwxC/djGCBCoOTLMBQ+2MlmDX+ejIg/7FEOMPoemHcrHMt3h0Jfo/Bn7o/VA6p6aNG+fQnZ0oAAE+B8FgKcmej/lwHMfL+RpZr8oCcYQNOD8RVPn2RZU49zZUicnaMX0btvpF99l2U/4cT0Fw3iJuSkpGlT+fvLeWCGkUqAM4gppWsFheLDNSn9v0FPXQimvdSalYIM0+Mx99JN3hhZU9rW2qMvVhXrhunOlgYM0glwBlFaGP/IaZBC+HT3HHCemCXN3FGvu6BeFmSMfhp0V4U/9tTX9ugLWdrejrPgEf7+cgbzamqKpXB4RXFV1ahvtqYX4Azikzz5b8fBEw3pQTjJIJiJs6T4SJaEOZx95QDX7a/tlKPJZx8TBnNZmMOXJ0y+1bSfGdtsCXBIH0D+EoAZbzWxFJO/+aSMz5KsCHNG//9ptuwf30tLuSrMLQgGh7s17cv5nZ0gq+paY7tdAY6lkn72BLIUk795K6IbmvL341mJA+lmYE4Lc25NK5IIOR0vYN4xtos+Wm5LgFsGMPahTiip0lh2w9+8FTFbmvF2E3t6exsH7MSgnBXmZFW9E32kjJkCIfXzWggratgKODsC3P0AkzZ+rWc/SZ4+KzJh7kBUF9V6GQdYFvZA6iwsZ4U5SVWfxpcnOEWlcJh666rm43ZByUCAe7WFpZb8TaciE+aqNRi3NgvCHNYhSwFmVjRY1iE5Kczh6gG3qu73YvmuaVDa2gqepuA9w+bTSRkJcP+rsxbgrJhlYY5V4ltbLStxQ5jzqGoJPw79BncoNEkKhU4Y5TsaoLQ19BfhPvpbJj+kCcDo/wtsCHBWZMLc69kR5pgW9eRJXYdK5gpzUZhzE7JQxqkZL9/lWC3ItaGDBYGuLaIN95MgwGUQgA3KtSEo+ig7whxTY1d3wdwvcDVe8mvJOWGuRNMeNr88lyMquIPq6cIHz9TZCYxs2m85bul305EJc1+EoXBN74U5dIXoEos+tH4fkVvCXHz1MqsSjQHBzORwFFD/TzsgWAAtBbjmPevAl47dwtxT2RHmMCGY/lqLdUGWS8KcefWycYE4kDPfa7Cl0RgC3JzPapjh+Ju1Swya015qg/wsFGQsJX7uhHVKnEvCnJuQm43Vy+bBmLrF3rIRo/hxpyh+7JAZ/YPsCHOYio794xmW3loVhTkjzJUEg8sTXt/FB/HyJ06x4MrfHE9W/r/Qbln+2yXOnuLKCLiyIMyx9uUAsw9EIZUw584FYU4i5JXu1cvxgDj3WISllbb8/2KAGW9aC2C2iYYnKkzYkE1hjn2P0LOvXBHmvEePXiIRoppXL2PmMGtXHXuKWEbB35yZhgC3LzMBzorY9+TN7bZcXzriOaZsxi9yks9MQ5jr15XTkqZJbLmGafUyWz7+SoutQThbAc6K2PeMtxuzJsxN2HCazSrDrfLsd2HOrar3enVxSr8oTAcjBCY+Y08WwGMmnoUAZ0X01+i30X9nIw4wYa7Sujrvd2FO1rS/mgMwE8aqNPZU2xHGmAD3cuYCnBUNYQ4zmLTxJx2NBQIf1FvWJ/0qzC08fPhCSVUrzf4f/Tj6c6b9pHsC8QbLgMULq4ozY8Zn4KRn7c3AdMSaYtq2VutA3J/CnBQMXu0m5BTv/69+s9lWNcoEuEAXy5ispvjZEGfT9NdbsmOAxQATnzqpx6dkLrI/hTk3IXew1WMm/4+5/JUvtNuqRjHIXf5Eh942CwHYIM6mog/r9H7SzcI0ZMLcmk6mM1k9JP0mzMmq+niCABdWWTU7fv1pPQtJckNmsjSvFwKcFVkdgsLcaht1SDrGDYhLIK3S5PgXNIeKv01hDvQP2Hbjh9PdN44C3Gc1TNdJm4EYAty7Zy/AWRGFOdTyr3jylC1XmI7oynARsGUciAtzcizW/X1Bn8OtaePdhLSZ1092C3A2vlphKd5yCnM+rWFvs/ib6i2ZMLfVnhaVjkyYe/6ELkkkiwNxYc6tqrfy49RnkFX1p2zwTesnPTECU/9p76bx6UdX1VsBzor4MFybRWEO3zeXVKeIA7or3sCPU59BUtU/4O/3ePC3G5BN+t+JG/XBZcu9zcTVxyviv93M/q0UwOTNAKWtdeBtqgNvo4kNMfA21NpgLLGdiaWtMZj7VQsUrgHAN3JGvwnEr2JwXxqya18FUFJ9Akrbm1jWw/P6ri6cATv5ceozeDTtBrmx8V2MA25V3SWp6i65Rt0x9cXjHxeuOlM99vc9GCwIdH0qltGd+BG2uJTuHLe2Y1fR3tqDcw5Gj8w+UFs5+0C08rpPokeK9sbIrI9qI7P2xMKW/CgWuW5vbfXs/dFKvW0i5xyKHJn+r6a9oo/uEMvoLtZnIneIy7s+LlzdeaRwdWdlKrpWnjk2bn3H7uKjke1SOPSyRAjPV7yNjdtlTev+eYVvDbgagnErDAkAnL8I9g2dcTg2ckYFx8OxkVdUBIezn6VcCEPw997y8pB0WN7P6Yg82cQf00tGL4RRl91GL7Ui7s9bACMT2vHMg6GsP+wL+zQzAOcX74Oh8m46Qt6tpmTx65GLAlBxAX/vDhw4cODAgQMHDhw4cODAgQMHDhw4GGD4P3aOqgTD04s9AAAAAElFTkSuQmCC","deepseek":"data:image/png;base64,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","xiaomi":"data:image/png;base64,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"};

// Provider records use `mimo`; the embedded Xiaomi artwork kept its original asset key.
platformLogoSources.mimo = platformLogoSources.xiaomi;

function platformLogo(providerId, sizeClass = "") {
  const source = platformLogoSources[providerId];
  const provider = providers[providerId];
  const safeClass = String(providerId || "unknown").replace(/[^a-z0-9_-]/gi, "-");
  if (!source) return `<span class="brand-logo ${escapeHtml(sizeClass)}" style="${providerStyle(providerId)}"><b>${escapeHtml(provider?.short || "?")}</b></span>`;
  return `<span class="brand-logo brand-logo-${safeClass} ${escapeHtml(sizeClass)}" style="${providerStyle(providerId)}"><span class="brand-logo-glow"></span><img src="${source}" alt="" draggable="false" /></span>`;
}

function resource(name, type, badge, metrics) { return { name, type, badge, metrics }; }

const state = { view: "overview", provider: "volcengine", accountId: null, renameAccountId: null, deleteAccountId: null, alertAccountId: null, connectionAccountId: null, diagnosticAccountId: null, alertFilter: "all", products: {}, backend: { accounts: [], history: [], syncEvents: [] }, syncPollTimer: null, syncPollUsers: 0, updateCheckStarted: false, availableUpdate: null, storageNoticeShown: false, metricRangeDays: 7, metricHistoryCache: new Map(), metricSelections: {}, metricHistoryRequestKey: "", trayTooltip: "", interfaceLanguage: "zh-CN", interfaceLanguagePreference:"system", languagePreferenceInitialized:false, languagePreferenceDirty:false, systemInterfaceLanguage:null };
Object.entries(providers).forEach(([id, p]) => state.products[id] = p.primaryProduct);
function remotePlaceholder(platformName, supported = false) {
  return {
    name: supported ? t("placeholderWaiting") : t("placeholderUnsupported"),
    kind: t("placeholderRemoteData"),
    usage: "—",
    usageLabel: supported ? t("placeholderNotConnected") : t("placeholderNoApi"),
    progress: 0,
    reset: supported ? t("placeholderSyncAfterConnect") : t("placeholderLaterVersion"),
    summaries: [
      [t("placeholderDataStatus"), t("placeholderNoRemoteData"), supported ? t("placeholderConnectAccount") : t("placeholderUnsupportedVersion")],
      [t("placeholderDataSource"), "—", t("placeholderNoLocalEstimates")],
      [t("placeholderLatestSync"), "—", t("placeholderNeverSynced")],
      [t("placeholderPlatform"), platformName, t("placeholderOfficialApi")]
    ],
    columns: [], rows: []
  };
}

function initializeRemoteOnlyProviders() {
  Object.entries(providers).forEach(([id, provider]) => {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    state.products[id] = "remote";
  });

  const openai = providers.openai;
  openai.description = t("providerOpenAiConnect");

  const xiaomi = providers.mimo;
  xiaomi.description = t("providerMimoUnavailable");
}

const els = Object.fromEntries([...document.querySelectorAll("[id]")].map(el => [el.id, el]));
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const localizedTextNodes = new WeakMap();
const staticMessages = window.PrismeterStaticMessages;

function t(key, values = {}) {
  return window.PrismeterI18n.t(key, values);
}

function localizeBootstrapProviders() {
  Object.assign(providers.openai, { description:t("bootstrapOpenAiDescription") });
  Object.assign(providers.volcengine, { name:t("bootstrapArkName"), short:t("bootstrapArkShort"), description:t("bootstrapArkDescription") });
  Object.assign(providers.mimo, { description:t("bootstrapMimoDescription") });
  Object.assign(providers.deepseek, { name:t("bootstrapDeepSeekName"), description:t("bootstrapDeepSeekDescription") });
  Object.assign(providers.kimi, { description:t("bootstrapKimiDescription") });
  Object.assign(providers.siliconflow, { name:t("providerSiliconFlow"), description:t("bootstrapSiliconFlowDescription") });
  Object.assign(providers.bailian, { name:t("providerBailian"), description:t("bootstrapBailianDescription") });
  Object.assign(providers.openrouter, { name:t("providerOpenRouter"), description:t("bootstrapOpenRouterDescription") });
}

function translateStatic(value) {
  if (state.interfaceLanguage !== "en") return value;
  // Text nodes in index.html often contain indentation and newlines. Look up
  // the meaningful copy while retaining its original whitespace for layout.
  const text = String(value ?? "");
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const prefix = match?.[1] || "";
  const copy = match?.[2] || text;
  const suffix = match?.[3] || "";
  const translated = staticMessages.exact[copy];
  if (translated) return `${prefix}${translated}${suffix}`;
  const localized = Object.entries(staticMessages.fragments)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((result, [chinese, english]) => result.split(chinese).join(english), copy);
  return localized === copy ? value : `${prefix}${localized}${suffix}`;
}

function localizeRemoteCopy(value) {
  const original = String(value ?? "");
  if (state.interfaceLanguage !== "en") return original;
  const remoteKeys = {
    "Codex 用量":"codex.product.kind",
    "当前周期":"codex.summary.currentWindow",
    "次级周期":"codex.summary.secondaryWindow",
    "累计 Token":"codex.summary.lifetimeTokens",
    "连续使用":"codex.summary.activeStreak",
    "每日远端统计":"codex.row.dailyUsage",
    "编程套餐":"ark.coding.product.kind",
    "在线推理":"ark.payg.product.kind",
    "按量 API":"ark.payg.product.name",
    "本月用量":"ark.coding.product.usageLabel",
    "本月总 Token":"ark.payg.product.usageLabel",
    "动态周期":"ark.note.dynamicCycle",
    "到期后重置":"ark.note.resetsAtExpiry",
    "输入 Token":"ark.payg.summary.inputTokens",
    "缓存命中":"ark.payg.summary.cacheHits",
    "输出 Token":"ark.payg.summary.outputTokens",
    "请求次数":"ark.payg.summary.requests"
    ,"账户订阅":"codex.subscription.kind"
    ,"时":"badge.hour"
    ,"周":"badge.week"
    ,"月":"badge.month"
    ,"日":"badge.day"
  };
  if (remoteKeys[original]) return t(remoteKeys[original]);
  let translated = translateStatic(original);
  if (translated !== original) return translated;
  return original
    .replace(/本月用量/g, "This month's usage")
    .replace(/(\d+)\s*天周期已用/g, "$1-day cycle used")
    .replace(/同步于\s*/g, "Synced ")
    .replace(/额度\s*(.+)\s*恢复/g, "Quota resets $1")
    .replace(/(\d+)\s*个账户/g, "$1 accounts")
    .replace(/(\d+)\s*条提醒/g, "$1 alerts")
    .replace(/按量 API/g, "Pay-as-you-go API")
    .replace(/远端同步/g, "Remote sync")
    .replace(/远端用量/g, "Remote usage")
    .replace(/官方用量/g, "Official usage")
    .replace(/当前总余额/g, "Current balance")
    .replace(/当前可用余额/g, "Available balance")
    .replace(/未连接/g, "Not connected")
    .replace(/已暂停/g, "Paused");
}

function localizeTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE || ["SCRIPT", "STYLE"].includes(node.parentElement?.tagName)) return;
  // `PrismeterI18n.apply` owns these nodes.  Translating them a second time is
  // especially harmful for combobox labels, whose text is replaced in-place.
  if (node.parentElement?.closest("[data-i18n]")) return;
  const previous = localizedTextNodes.get(node);
  // A render can reuse a text node and change its contents (for example, the
  // Overview heading after sync). Treat values other than our previous source
  // or translation as fresh source copy instead of translating stale content.
  const current = node.nodeValue;
  const original = !previous || (current !== previous.original && current !== previous.rendered)
    ? current
    : previous.original;
  const translated = translateStatic(original);
  localizedTextNodes.set(node, { original, rendered:translated });
  if (current !== translated) node.nodeValue = translated;
}

function localizeSubtree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) return localizeTextNode(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) localizeTextNode(node);
  if (root.nodeType === Node.ELEMENT_NODE) {
    [root, ...root.querySelectorAll("[title], [aria-label], [placeholder]")].forEach(element => {
      ["title", "aria-label", "placeholder"].forEach(attribute => {
        if (!element.hasAttribute(attribute)) return;
        const original = element.dataset[`i18n${attribute.replace(/-([a-z])/g, (_, char) => char.toUpperCase())}`] || element.getAttribute(attribute);
        const dataKey = `i18n${attribute.replace(/-([a-z])/g, (_, char) => char.toUpperCase())}`;
        if (!element.dataset[dataKey]) element.dataset[dataKey] = original;
        element.setAttribute(attribute, translateStatic(original));
      });
    });
  }
}

function normalizeInterfaceLanguagePreference(language) {
  return ["system", "zh-CN", "en"].includes(language) ? language : "system";
}

function browserSystemInterfaceLanguage() {
  return (navigator.languages?.[0] || navigator.language || "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs))
  ]);
}

async function initializeSystemInterfaceLanguage() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
    state.systemInterfaceLanguage = browserSystemInterfaceLanguage();
    return;
  }
  try {
    const locale = String(await withTimeout(invoke("get_system_locale"), 1500, "System locale lookup") || "").toLowerCase();
    state.systemInterfaceLanguage = locale.startsWith("zh") ? "zh-CN" : "en";
  } catch (error) {
    console.error("Unable to read the system interface language", error);
    state.systemInterfaceLanguage = browserSystemInterfaceLanguage();
  }
}

function applyInterfaceLanguage(language = "system") {
  const preference = normalizeInterfaceLanguagePreference(language);
  const normalized = language === "system"
    ? (state.systemInterfaceLanguage || browserSystemInterfaceLanguage())
    : language === "en" ? "en" : "zh-CN";
  state.interfaceLanguage = normalized;
  window.PrismeterI18n.setLanguage(normalized);
  localizeBootstrapProviders();
  window.PrismeterI18n.apply(document.body);
  // Combobox labels are derived from option text. Refresh them after the
  // catalog has updated the option nodes, rather than retaining the old locale.
  if (els.interfaceLanguage) {
    const value = preference === "system" ? "system" : normalized;
    const option = [...els.interfaceLanguage.closest("[data-combobox]")?.querySelectorAll(".combo-option[data-value]") || []]
      .find(item => item.dataset.value === value);
    const label = option?.querySelector("span")?.textContent || option?.textContent;
    els.interfaceLanguage.value = value;
    if (label) els.interfaceLanguage.closest("[data-combobox]")?.querySelector("[data-combo-label]")?.replaceChildren(label.trim());
  }
  document.title = t("appTitle");
  localizeSubtree(document.body);
}

function rerenderForInterfaceLanguage() {
  renderNavigation();
  renderOverview();
  renderAccounts();
  renderAlerts();
  renderComparisons();
  switchView(state.view);
}

const interfaceLanguageObserver = new MutationObserver(records => {
  if (state.interfaceLanguage !== "en") return;
  for (const record of records) {
    if (record.type === "characterData") localizeTextNode(record.target);
    record.addedNodes.forEach(localizeSubtree);
    if (record.type === "attributes") localizeSubtree(record.target);
  }
});

function applyTheme(mode = "system", persist = true) {
  const normalized = ["system", "light", "dark"].includes(mode) ? mode : "system";
  const resolved = normalized === "system" ? (systemThemeQuery.matches ? "dark" : "light") : normalized;
  document.documentElement.dataset.themeMode = normalized;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#101522" : "#e8edf6");
  if (persist) document.cookie = `prismeter-theme=${normalized}; Max-Age=31536000; Path=/; SameSite=Strict`;
}

systemThemeQuery.addEventListener("change", () => {
  if ((state.backend.settings?.appearanceMode || document.documentElement.dataset.themeMode) === "system") applyTheme("system", false);
});

function providerStyle(id) {
  const p = providers[id] || { color:"#667085", gradient:"linear-gradient(135deg,#667085,#98a2b3)" };
  return `--platform-color:${p.color};--platform-gradient:${p.gradient}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function errorMessage(error, fallback = t("operationIncomplete")) {
  const backendCodes = { not_found:"backendNotFound", sync_in_progress:"backendSyncInProgress", invalid_input:"backendInvalidInput", unsupported:"backendUnsupported", permission_denied:"backendPermissionDenied", operation_failed:"backendOperationFailed" };
  const code = error?.errorCode || error?.code;
  if (backendCodes[code]) return t(backendCodes[code]);
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  if (typeof error?.error === "string" && error.error.trim()) return error.error;
  return fallback;
}

function moneySymbol(currency) { return currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency || ""} `; }

function formatDate(value) {
  if (!value) return t("notSynced");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("invalidTime");
  return window.PrismeterI18n.formatDate(date, { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function relativeSyncTime(value) {
  if (!value) return t("neverSynced");
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return t("invalidTime");
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count:minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count:hours });
  return t("daysAgo", { count:Math.floor(hours / 24) });
}

function relativeFutureTime(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const remaining = timestamp - Date.now();
  if (remaining <= 0) return t("retrySoon");
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  return minutes < 60 ? t("retryMinutes", { count:minutes }) : t("retryHours", { count:Math.ceil(minutes / 60) });
}

function accountFreshness(account) {
  if (account?.enabled === false) return { level:"paused", label:t("monitoringPaused"), detail:t("pausedDetail") };
  if (!account?.lastSync) return { level:"never", label:t("notSynced"), detail:t("firstSync") };
  const elapsedMinutes = Math.max(0, (Date.now() - new Date(account.lastSync).getTime()) / 60000);
  const configured = Number(state.backend.settings?.autoSyncMinutes || 0);
  const accountStaleLimit = account?.alertSettings?.staleAfterMinutes;
  const explicitStaleLimit = Number(accountStaleLimit ?? state.backend.settings?.staleAfterMinutes ?? 0);
  const staleLimit = explicitStaleLimit || (configured ? Math.max(60, configured * 3) : 360);
  const expectedFreshLimit = configured ? Math.max(15, configured * 1.5) : 60;
  const freshLimit = Math.min(expectedFreshLimit, staleLimit / 2);
  const relative = relativeSyncTime(account.lastSync);
  if (account.lastError) return { level:"error", label:Number(account.consecutiveFailures || 0) >= 3 ? t("repeatedFailure") : t("syncFailed"), detail:t("lastSuccess", { time:relative }) };
  if (elapsedMinutes <= freshLimit) return { level:"fresh", label:t("dataFresh"), detail:t("updatedAt", { time:relative }) };
  if (elapsedMinutes <= staleLimit) return { level:"aging", label:t("refreshRecommended"), detail:t("updatedAt", { time:relative }) };
  return { level:"stale", label:t("dataStale"), detail:t("updatedAt", { time:relative }) };
}

function overallFreshness(accounts = state.backend.accounts || []) {
  const counts = { fresh:0, aging:0, stale:0, error:0, never:0, paused:0 };
  accounts.forEach(account => counts[accountFreshness(account).level]++);
  const healthy = counts.fresh;
  const monitored = accounts.length - counts.paused;
  return { counts, healthy, monitored, attention:monitored - healthy };
}

async function apiRequest(path, options = {}, allowPartial = false) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({ error: t("localServiceError") }));
  if (!response.ok || (!allowPartial && payload.ok === false)) {
    const error = new Error(payload.error || t("operationFailed"));
    error.errorCode = payload.errorCode;
    throw error;
  }
  return payload;
}

function formatDuration(value) {
  const milliseconds = Number(value || 0);
  if (!milliseconds) return t("noDuration");
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0)} s`;
}

function safeFilePart(value) {
  return String(value || "data").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "data";
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCurrentProduct() {
  const provider = providers[state.provider];
  const account = getSelectedAccount(state.provider);
  const product = provider?.products?.[state.products[state.provider]];
  if (!account || !product || !(product.rows || []).length) {
    showToast(t("csvNoRemoteDetails"));
    return;
  }
  const header = [t("csvPlatform"), t("csvAccount"), t("csvProduct"), t("csvResourceDate"), t("csvType"), ...(product.columns || [])];
  const rows = (product.rows || []).map(row => [
    provider.name, accountDisplayName(account), product.name, row.name, row.type,
    ...(row.metrics || []).map(metric => metric?.[0] ?? "—")
  ]);
  const meta = [
    [t("csvDataSource"), t("csvOfficialRemote")],
    [t("csvLastSync"), account.lastSync || "—"],
    [t("csvExportTime"), new Date().toISOString()]
  ];
  const csv = "\uFEFF" + [
    ...meta.map(row => row.map(csvCell).join(",")),
    "",
    header.map(csvCell).join(","),
    ...rows.map(row => row.map(csvCell).join(","))
  ].join("\r\n");
  downloadText(`Prismeter-${safeFilePart(provider.name)}-${safeFilePart(product.name)}-${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv;charset=utf-8");
  showToast(t("csvExported"));
}

function getSelectedAccount(providerId = state.provider) {
  const accounts = state.backend.accounts || [];
  return accounts.find(account => account.id === state.accountId && account.provider === providerId)
    || accounts.find(account => account.provider === providerId);
}

function applyDeepSeekAccountData(account = getSelectedAccount("deepseek")) {
  const provider = providers.deepseek;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerNoBalanceAccount", { provider: "DeepSeek " });
    state.products.deepseek = "remote";
    return;
  }

  const balance = account.balances?.find(item => item.currency === "CNY") || account.balances?.[0];
  const symbol = moneySymbol(balance?.currency);
  const historyCount = state.backend.history.filter(item => item.accountId === account.id).length;
  provider.description = t("providerBalanceDescription", { account: accountDisplayName(account), provider: "DeepSeek ", hint: account.keyHint });
  provider.products = { api: {
    name: "DeepSeek API",
    kind: t("providerPayg"),
    usage: balance ? `${symbol} ${balance.total}` : "—",
    usageLabel: t("providerCurrentTotal"),
    progress: 0,
    reset: t("providerSyncedAt", { time: formatDate(account.lastSync) }),
    summaries: [
      [t("providerCurrentTotal"), balance ? `${symbol} ${balance.total}` : "—", "DeepSeek " + t("providerOfficial")],
      [t("providerPromotionalBalance"), balance ? `${symbol} ${balance.granted}` : "—", t("providerOfficial")],
      [t("providerCashBalance"), balance ? `${symbol} ${balance.toppedUp}` : "—", t("providerOfficial")],
      [t("providerLocalSnapshots"), t("providerSnapshotCount", { count: historyCount }), t("providerCollectedAfterConnect")]
    ],
    columns: [t("providerCurrency"), t("providerTotalBalance"), t("providerPromotionalBalance"), t("providerCashBalance")],
    rows: (account.balances || []).map(item => resource(accountDisplayName(account), account.isAvailable ? t("providerApiAvailable") : t("providerBalanceUnavailable"), "DS", [
      [item.currency, t("providerOfficial")], [`${moneySymbol(item.currency)} ${item.total}`, t("providerOfficial")], [`${moneySymbol(item.currency)} ${item.granted}`, t("providerOfficial")], [`${moneySymbol(item.currency)} ${item.toppedUp}`, t("providerOfficial")]
    ]))
  }};
  provider.primaryProduct = "api";
  if (!provider.products[state.products.deepseek]) state.products.deepseek = "api";
}

function applyKimiAccountData(account = getSelectedAccount("kimi")) {
  const provider = providers.kimi;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerNoBalanceAccount", { provider: "Kimi " });
    state.products.kimi = "remote";
    return;
  }
  const balance = account.balances?.find(item => item.currency === "CNY") || account.balances?.[0];
  const historyCount = state.backend.history.filter(item => item.accountId === account.id).length;
  provider.description = t("providerBalanceDescription", { account: accountDisplayName(account), provider: "Kimi ", hint: account.keyHint });
  provider.products = { api: {
    name: "Kimi API", kind: t("providerPayg"), usage: balance ? `¥ ${balance.total}` : "—", usageLabel: t("providerAvailableBalance"), progress: 0,
    reset: t("providerSyncedAt", { time: formatDate(account.lastSync) }),
    summaries: [[t("providerAvailableBalance"), balance ? `¥ ${balance.total}` : "—", "Kimi " + t("providerOfficial")], [t("providerVoucherBalance"), balance ? `¥ ${balance.granted}` : "—", "Kimi " + t("providerOfficial")], [t("providerKimiCashBalance"), balance ? `¥ ${balance.toppedUp}` : "—", "Kimi " + t("providerOfficial")], [t("providerLocalSnapshots"), t("providerSnapshotCount", { count: historyCount }), t("providerCollectedAfterConnect")]],
    columns: [t("providerCurrency"), t("providerAvailableBalance"), t("providerVoucherBalance"), t("providerKimiCashBalance")],
    rows: (account.balances || []).map(item => resource(accountDisplayName(account), account.isAvailable ? t("providerApiAvailable") : t("providerBalanceUnavailable"), "Ki", [[item.currency, t("providerOfficial")], [`¥ ${item.total}`, t("providerOfficial")], [`¥ ${item.granted}`, t("providerOfficial")], [`¥ ${item.toppedUp}`, t("providerOfficial")]]))
  }};
  provider.primaryProduct = "api";
  if (!provider.products[state.products.kimi]) state.products.kimi = "api";
}

function applySiliconFlowAccountData(account = getSelectedAccount("siliconflow")) {
  const provider = providers.siliconflow;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerNoBalanceAccount", { provider: `${provider.name} ` });
    state.products.siliconflow = "remote";
    return;
  }
  const balance = account.balances?.find(item => item.currency === "CNY") || account.balances?.[0];
  const historyCount = state.backend.history.filter(item => item.accountId === account.id).length;
  provider.description = t("providerBalanceDescription", { account: accountDisplayName(account), provider: `${provider.name} `, hint: account.keyHint });
  provider.products = { api: {
    name: "SiliconFlow API", kind: t("providerPayg"), usage: balance ? `¥ ${balance.total}` : "—", usageLabel: t("providerTotalBalance"), progress: 0,
    reset: t("providerSyncedAt", { time: formatDate(account.lastSync) }),
    summaries: [[t("providerTotalBalance"), balance ? `¥ ${balance.total}` : "—", `${provider.name} ${t("providerOfficial")}`], [t("providerSiliconFlowBalance"), balance ? `¥ ${balance.granted}` : "—", `${provider.name} ${t("providerOfficial")}`], [t("providerCashBalance"), balance ? `¥ ${balance.toppedUp}` : "—", `${provider.name} ${t("providerOfficial")}`], [t("providerLocalSnapshots"), t("providerSnapshotCount", { count: historyCount }), t("providerCollectedAfterConnect")]],
    columns: [t("providerCurrency"), t("providerTotalBalance"), t("providerSiliconFlowBalance"), t("providerCashBalance")],
    rows: (account.balances || []).map(item => resource(accountDisplayName(account), account.isAvailable ? t("providerApiAvailable") : t("providerBalanceUnavailable"), "SF", [[item.currency, t("providerOfficial")], [`¥ ${item.total}`, t("providerOfficial")], [`¥ ${item.granted}`, t("providerOfficial")], [`¥ ${item.toppedUp}`, t("providerOfficial")]]))
  }};
  provider.primaryProduct = "api";
  if (!provider.products[state.products.siliconflow]) state.products.siliconflow = "api";
}

function applyOpenRouterAccountData(account = getSelectedAccount("openrouter")) {
  const provider = providers.openrouter;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerNoBalanceAccount", { provider: `${provider.name} ` });
    state.products.openrouter = "remote";
    return;
  }
  const balance = account.balances?.find(item => item.currency === "USD") || account.balances?.[0];
  const historyCount = state.backend.history.filter(item => item.accountId === account.id).length;
  provider.description = t("providerBalanceDescription", { account: accountDisplayName(account), provider: `${provider.name} `, hint: account.keyHint });
  provider.products = { api: {
    name: "OpenRouter API", kind: t("providerPayg"), usage: balance ? `$ ${balance.total}` : "-", usageLabel: t("providerOpenRouterRemaining"), progress: 0,
    reset: t("providerSyncedAt", { time: formatDate(account.lastSync) }),
    summaries: [[t("providerOpenRouterRemaining"), balance ? `$ ${balance.total}` : "-", `${provider.name} ${t("providerOfficial")}`], [t("providerOpenRouterUsed"), balance ? `$ ${balance.toppedUp}` : "-", `${provider.name} ${t("providerOfficial")}`], [t("providerOpenRouterUsageMonthly"), balance && balance.usageMonthly ? `$ ${balance.usageMonthly}` : "-", `${provider.name} ${t("providerOfficial")}`], [t("providerOpenRouterUsageWeekly"), balance && balance.usageWeekly ? `$ ${balance.usageWeekly}` : "-", `${provider.name} ${t("providerOfficial")}`], [t("providerOpenRouterUsageDaily"), balance && balance.usageDaily ? `$ ${balance.usageDaily}` : "-", `${provider.name} ${t("providerOfficial")}`], [t("providerOpenRouterLimit"), balance ? `$ ${balance.granted}` : "-", `${provider.name} ${t("providerOfficial")}`], [t("providerLocalSnapshots"), t("providerSnapshotCount", { count: historyCount }), t("providerCollectedAfterConnect")]],
    columns: [t("providerCurrency"), t("providerOpenRouterRemaining"), t("providerOpenRouterUsed"), t("providerOpenRouterLimit")],
    rows: (account.balances || []).map(item => resource(accountDisplayName(account), account.isAvailable ? t("providerApiAvailable") : t("providerBalanceUnavailable"), "OR", [[item.currency, t("providerOfficial")], [`$ ${item.total}`, t("providerOfficial")], [`$ ${item.toppedUp}`, t("providerOfficial")], [`$ ${item.granted}`, t("providerOfficial")]]))
  }};
  provider.primaryProduct = "api";
  if (!provider.products[state.products.openrouter]) state.products.openrouter = "api";
}

function i18nField(value, key, params) {
  return key && window.PrismeterI18n.has(key) ? t(key, params) : localizeRemoteCopy(value);
}

function localizeMetricHistoryLabel(label) {
  const original = String(label || "");
  if (state.interfaceLanguage !== "en") return original;
  const windowMatch = original.match(/^(\d+)\s*分钟周期已用$/);
  if (windowMatch) return t("codex.usage.windowUsed", { minutes:windowMatch[1] });
  const keys = {
    "当前周期":"codex.summary.currentWindow",
    "次级周期":"codex.summary.secondaryWindow",
    "累计 Token":"codex.summary.lifetimeTokens",
    "连续使用":"codex.summary.activeStreak",
    "主要指标":"detailCurrentRemote",
    "当前周期用量":"ark.coding.quota.primary",
    "本周用量":"ark.coding.quota.secondary",
    "本月用量":"ark.coding.quota.additional",
    "本月总 Token":"ark.payg.product.usageLabel",
    "输入 Token":"ark.payg.summary.inputTokens",
    "缓存命中":"ark.payg.summary.cacheHits",
    "输出 Token":"ark.payg.summary.outputTokens",
    "请求次数":"ark.payg.summary.requests"
  };
  return keys[original] ? t(keys[original]) : localizeRemoteCopy(original);
}

function accountDisplayName(account) {
  return i18nField(account?.name || "", account?.nameKey);
}

function localizeBackendErrors(errors = [], codes = []) {
  return errors.map((error, index) => {
    const code = codes[index];
    return code ? errorMessage({ errorCode: code }, localizeRemoteCopy(error)) : localizeRemoteCopy(error);
  });
}

function localizeSyncEventMessage(event) {
  if (event?.messageCode === "sync_succeeded") return t("historyRemoteUpdated");
  if (event?.messageCode) return errorMessage({ errorCode: event.messageCode }, localizeRemoteCopy(event.message));
  return localizeRemoteCopy(event?.message || (event?.success ? t("historyRemoteUpdated") : t("historyRemoteRequestFailed")));
}

function applyOpenAIAccountData(account = getSelectedAccount("openai")) {
  const provider = providers.openai;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerOpenAiConnect");
    state.products.openai = "remote";
    return;
  }

  const products = {};
  for (const item of account.products || []) {
    const percent = String(item.usage || "").match(/(-?\d+(?:\.\d+)?)\s*%/);
    products[item.id] = {
      name: i18nField(item.name || item.id, item.nameKey || item.i18n?.nameKey),
      kind: i18nField(item.kind, item.kindKey || item.i18n?.kindKey) || t("providerChatGptSubscription"),
      usage: item.usage || "—",
      usageLabel: i18nField(item.usageLabel, item.usageLabelKey, item.usageLabelParams) || t("remoteUsage"),
      progress: percent ? Math.max(0, Math.min(100, Number(percent[1]))) : 0,
      resetAt: item.resetAt || null,
      reset: item.resetAt ? t("providerQuotaRestore", { time: relativeFutureTime(item.resetAt) }) : t("providerSyncedAt", { time: formatDate(account.lastSync) }),
      summaries: (item.summaries || []).map((metric, index) => { const keys = item.i18n?.summaryKeys?.[index] || metric; return [i18nField(metric.label, keys.labelKey), i18nField(metric.value, keys.valueKey, keys.valueParams), i18nField(metric.note, keys.noteKey, keys.noteParams)]; }),
      columns: (item.columns || []).map((column, index) => i18nField(column, item.i18n?.columnKeys?.[index])),
      rows: (item.rows || []).map(row => resource(i18nField(row.name, row.nameKey || row.i18n?.nameKey), i18nField(row.type, row.typeKey || row.i18n?.typeKey), i18nField(row.badge, row.badgeKey || row.i18n?.badgeKey), (row.metrics || []).map((metric, index) => [metric.value, i18nField(metric.unit, row.i18n?.metricUnitKeys?.[index])])) )
    };
  }
  provider.products = products;
  provider.primaryProduct = Object.keys(products)[0] || "codex";
  provider.description = t("providerOpenAiDescription", { account: accountDisplayName(account), plan: account.planType || "ChatGPT", email: account.email || t("providerOfficialLogin") });
  if (!provider.products[state.products.openai]) state.products.openai = provider.primaryProduct;
}

function applyVolcengineAccountData(account = getSelectedAccount("volcengine")) {
  const provider = providers.volcengine;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerArkConnect");
    state.products.volcengine = "remote";
    return;
  }

  const products = {};
  for (const item of account.products || []) {
    const percent = String(item.usage || "").match(/(-?\d+(?:\.\d+)?)\s*%/);
    products[item.id] = {
      name: i18nField(item.name || item.id, item.nameKey || item.i18n?.nameKey),
      kind: i18nField(item.kind, item.kindKey || item.i18n?.kindKey) || t("providerOfficialProduct"),
      usage: item.usage || "—",
      usageLabel: i18nField(item.usageLabel, item.usageLabelKey, item.usageLabelParams) || t("officialProduct"),
      progress: percent ? Math.max(0, Math.min(100, Number(percent[1]))) : 0,
      reset: t("providerSyncedAt", { time: formatDate(account.lastSync) }),
      summaries: (item.summaries || []).map((metric, index) => { const keys = item.i18n?.summaryKeys?.[index] || metric; return [i18nField(metric.label, keys.labelKey), i18nField(metric.value, keys.valueKey, keys.valueParams), i18nField(metric.note, keys.noteKey, keys.noteParams)]; }),
      columns: (item.columns || []).map((column, index) => i18nField(column, item.i18n?.columnKeys?.[index])),
      rows: (item.rows || []).map(row => resource(i18nField(row.name, row.nameKey || row.i18n?.nameKey), i18nField(row.type, row.typeKey || row.i18n?.typeKey), i18nField(row.badge, row.badgeKey || row.i18n?.badgeKey), (row.metrics || []).map((metric, index) => [metric.value, i18nField(metric.unit, row.i18n?.metricUnitKeys?.[index])])) )
    };
  }
  provider.products = products;
  provider.primaryProduct = Object.keys(products)[0] || "payg";
  provider.description = `${accountDisplayName(account)} · ${account.keyHint} · ${account.projectName || APP_DEFAULTS.volcengineProject}`;
  if (!provider.products[state.products.volcengine]) state.products.volcengine = provider.primaryProduct;
}

function applyMimoAccountData(account = getSelectedAccount("mimo")) {
  const provider = providers.mimo;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerMimoConnect");
    state.products.mimo = "remote";
    return;
  }
  const products = {};
  for (const item of account.products || []) {
    products[item.id] = {
      name: i18nField(item.name || item.id, item.nameKey || item.i18n?.nameKey),
      kind: i18nField(item.kind, item.kindKey || item.i18n?.kindKey) || t("providerApiKeyCapability"),
      usage: item.usage || "—",
      usageLabel: i18nField(item.usageLabel, item.usageLabelKey, item.usageLabelParams) || t("providerRemoteModels"),
      progress: 0,
      reset: t("providerSyncedAt", { time: formatDate(account.lastSync) }),
      summaries: (item.summaries || []).map((metric, index) => { const keys = item.i18n?.summaryKeys?.[index] || metric; return [i18nField(metric.label, keys.labelKey), i18nField(metric.value, keys.valueKey, keys.valueParams), i18nField(metric.note, keys.noteKey, keys.noteParams)]; }),
      columns: (item.columns || []).map((column, index) => i18nField(column, item.i18n?.columnKeys?.[index])),
      rows: (item.rows || []).map(row => resource(i18nField(row.name, row.nameKey || row.i18n?.nameKey), i18nField(row.type, row.typeKey || row.i18n?.typeKey), i18nField(row.badge, row.badgeKey || row.i18n?.badgeKey), (row.metrics || []).map((metric, index) => [metric.value, i18nField(metric.unit, row.i18n?.metricUnitKeys?.[index])])) )
    };
  }
  provider.products = products;
  provider.primaryProduct = Object.keys(products)[0] || "mimo-models";
  provider.description = t("providerMimoDescription", { account: accountDisplayName(account), plan: account.planType === "token_plan" ? "Token Plan" : t("providerPayg"), hint: account.keyHint });
  if (!provider.products[state.products.mimo]) state.products.mimo = provider.primaryProduct;
}

function runUiStateStep(name, callback) {
  try {
    const result = callback();
    if (result?.catch) result.catch(error => console.error(`Async UI state step failed: ${name}`, error));
  } catch (error) {
    console.error(`UI state step failed: ${name}`, error);
  }
}

function applyBailianAccountData(account = getSelectedAccount("bailian")) {
  const provider = providers.bailian;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = t("providerBailianConnect");
    state.products.bailian = "remote";
    return;
  }
  const products = {};
  for (const item of account.products || []) {
    products[item.id] = {
      name: item.name || item.id, kind: item.kind || t("providerApiKeyCapability"), usage: item.usage || "—",
      usageLabel: item.usageLabel || t("providerRemoteModels"), progress: 0,
      reset: t("providerSyncedAt", { time: formatDate(account.lastSync) }),
      summaries: (item.summaries || []).map(metric => [metric.label, metric.value, metric.note]),
      columns: item.columns || [], rows: (item.rows || []).map(row => resource(row.name, row.type, row.badge, (row.metrics || []).map(metric => [metric.value, metric.unit])))
    };
  }
  provider.products = products;
  provider.primaryProduct = Object.keys(products)[0] || "bailian-models";
  provider.description = t("providerBailianDescription", { account: accountDisplayName(account), hint: account.keyHint });
  if (!provider.products[state.products.bailian]) state.products.bailian = provider.primaryProduct;
}

async function loadBackendState({quiet = false} = {}) {
  let payload;
  try {
    payload = await apiRequest("/api/state");
  } catch (error) {
    els.syncText.textContent = t("localServiceUnavailable");
    if (!quiet) showToast(errorMessage(error));
    return false;
  }

  state.backend = payload;
  if (!state.languagePreferenceInitialized) {
    state.interfaceLanguagePreference = normalizeInterfaceLanguagePreference(payload.settings?.interfaceLanguage);
    state.languagePreferenceInitialized = true;
  }
  if (state.languagePreferenceDirty && payload.settings) payload.settings.interfaceLanguage = state.interfaceLanguagePreference;

  runUiStateStep("language", () => applyInterfaceLanguage(state.interfaceLanguagePreference));
  runUiStateStep("theme", () => applyTheme(payload.settings?.appearanceMode || "system"));
  if (state.accountId && !payload.accounts.some(account => account.id === state.accountId)) state.accountId = null;
  runUiStateStep("deepseek account adapter", () => applyDeepSeekAccountData());
  runUiStateStep("openai account adapter", () => applyOpenAIAccountData());
  runUiStateStep("volcengine account adapter", () => applyVolcengineAccountData());
  runUiStateStep("mimo account adapter", () => applyMimoAccountData());
  runUiStateStep("navigation", renderNavigation);
  runUiStateStep("overview", renderOverview);
  runUiStateStep("accounts", renderAccounts);
  runUiStateStep("alerts", renderAlerts);
  runUiStateStep("settings", populateSettings);
  runUiStateStep("updates", maybeCheckForUpdates);
  if (state.view === "platforms") runUiStateStep("platform", renderPlatform);
  if (state.view === "models") runUiStateStep("comparisons", renderComparisons);
  runUiStateStep("active view", () => switchView(state.view));
  updateTrayTooltip(payload).catch(error => console.error("Unable to update the tray tooltip", error));
  syncDesktopPreferences(payload.settings).catch(error => console.error("Unable to apply desktop preferences", error));
  if (!quiet) els.syncText.textContent = state.backend.accounts.length ? formatSyncSetting() : t("waitingForAccounts");
  if (payload.startupNotice && !state.storageNoticeShown) {
    state.storageNoticeShown = true;
    showToast(payload.startupNotice, "warning");
  }
  return true;
}

function monitoringSummary(payload = state.backend) {
  const accounts = payload.accounts || [];
  const monitored = accounts.filter(account => account.enabled !== false);
  if (!accounts.length) return { level:"empty", title:t("noAccounts"), detail:t("addAccountInApp") };
  if (!monitored.length) return { level:"paused", title:t("monitoringPaused"), detail:t("allAccountsPaused", { count:accounts.length }) };
  const failed = monitored.find(account => account.lastError);
  if (failed) return { level:"attention", title:t("needsAttention"), detail:t("syncFailedFor", { name:failed.name }) };
  const stale = monitored.find(account => accountFreshness(account).level === "stale" || accountFreshness(account).level === "never");
  if (stale) return { level:"attention", title:t("refreshNeeded"), detail:`${stale.name} ${accountFreshness(stale).label}` };
  const alerts = actionableAlerts(payload);
  if (alerts.length) {
    const alert = alerts[0];
    const account = monitored.find(item => item.id === alert.accountId);
    const resetAt = alert.kind === "quota" ? productResetAt(account, alert.productId) : null;
    const recovery = resetAt ? ` · ${t("restoreAfter", { time:relativeFutureTime(resetAt) })}` : "";
    return { level:"attention", title:t("usageNeedsAttention"), detail:`${localizedAlertTitle(alert) || t("alertsWaiting", { count:alerts.length })}${recovery}` };
  }
  return { level:"healthy", title:t("readyToUse"), detail:t("healthyAccounts", { count:monitored.length }) };
}

function productResetAt(account, productId = "") {
  const product = (account?.products || []).find(item => !productId || item.id === productId);
  const value = product?.resetAt;
  return value && Number.isFinite(new Date(value).getTime()) ? value : null;
}

function isAlertSnoozed(alert) {
  return Boolean(alert?.snoozedUntil) && new Date(alert.snoozedUntil).getTime() > Date.now();
}

function actionableAlerts(payload = state.backend) {
  return (payload.alerts || []).filter(alert => !isAlertSnoozed(alert));
}

function localizedAlertTitle(alert) {
  const account = (state.backend.accounts || []).find(item => item.id === alert?.accountId);
  const product = account?.products?.find(item => item.id === alert?.productId);
  const params = {
    ...(alert?.titleParams || {}),
    account:account ? accountDisplayName(account) : alert?.titleParams?.account,
    product:product ? i18nField(product.name, product.nameKey || product.i18n?.nameKey) : alert?.titleParams?.product
  };
  return i18nField(alert?.title || t("remoteStatusAttention"), alert?.titleKey, params);
}

function localizedAlertMessage(alert) {
  return i18nField(alert?.message || t("alertDetail"), alert?.messageKey, alert?.messageParams);
}

function automaticSyncLabel(settings = state.backend.settings) {
  const minutes = Number(settings?.autoSyncMinutes || 0);
  if (!minutes) return t("automaticSyncOff");
  const next = state.backend.nextAutomaticSyncAt;
  return next ? t("nextSync", { minutes, time:relativeFutureTime(next) }) : t("automaticSyncEvery", { minutes });
}

async function updateTrayTooltip(payload = state.backend) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  const summary = monitoringSummary(payload);
  const tooltip = `Prismeter · ${summary.title}\n${summary.detail}\n${automaticSyncLabel(payload.settings)}`;
  if (tooltip === state.trayTooltip) return;
  try {
    await invoke("set_tray_tooltip", { tooltip });
    state.trayTooltip = tooltip;
  } catch (_) {
    // The desktop shell may not be ready during the first page render.
  }
}

function renderNavigation() {
  const accounts = state.backend.accounts || [];
  els.platformNav.innerHTML = accounts.length ? accounts.map(account => {
    const provider = providers[account.provider];
    const accountId = escapeHtml(account.id);
    return `<button class="${account.id === state.accountId ? 'active' : ''} ${account.enabled === false ? 'paused-account' : ''}" data-account="${accountId}" data-sort-account="${accountId}" data-account-provider="${escapeHtml(account.provider)}">${platformLogo(account.provider, "nav-brand-logo")}<span><b>${escapeHtml(accountDisplayName(account))}</b><small>${escapeHtml(provider?.name || account.provider)}</small></span><i class="drag-handle nav-drag-handle" data-drag-account="${accountId}" title="${t("dragToSort")}" aria-label="${t("dragToSort")}">⋮⋮</i></button>`;
  }).join("") : `<button class="nav-empty-account" data-view="accounts"><span class="nav-add-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span><b>${t("addAccount")}</b><small>${t("showHereAfterConnection")}</small></span></button>`;
}

function renderOverview() {
  const accounts = state.backend.accounts || [];
  const connectedCount = accounts.length;
  const alertCount = actionableAlerts().length;
  const freshness = overallFreshness(accounts);
  const activeCount = freshness.monitored;
  const monitoring = monitoringSummary();
  const pausedSuffix = freshness.counts.paused ? ` · ${t("pausedAccounts", { count:freshness.counts.paused })}` : "";
  els.globalStatusText.textContent = `${monitoring.title} · ${monitoring.detail}${pausedSuffix}`;
  const livePill = document.querySelector(".live-pill");
  livePill.classList.toggle("attention", connectedCount > 0 && freshness.attention > 0);
  livePill.classList.toggle("empty", connectedCount === 0);
  document.querySelector(".hero-copy > p").textContent = t("availability");
  document.querySelector(".hero-value strong").textContent = String(activeCount);
  document.querySelector(".hero-value span").textContent = t("monitoredAccounts");
  document.querySelector(".hero-delta").innerHTML = monitoring.level === "healthy"
    ? `<b>${t("continueSafely")}</b> · ${t("noRemoteAlerts")}`
    : monitoring.level === "empty" ? `<b>${t("waitingForAccounts")}</b> · ${t("startMonitoring")}`
    : `<b>${escapeHtml(monitoring.detail)}</b> · ${t("openAccountsForReason")}`;
  document.querySelector(".hero-chart-wrap").hidden = false;
  document.querySelector("#heroHealthy").textContent = String(freshness.healthy);
  document.querySelector("#heroAttention").textContent = String(freshness.attention);
  document.querySelector("#heroPaused").textContent = String(freshness.counts.paused);
  document.querySelector("#heroSchedule").textContent = automaticSyncLabel();
  renderActionCenter();
  const insight = document.querySelector(".insight-card");
  insight.querySelector("h3").textContent = t("overviewAllRemote");
  insight.querySelector("p:not(.eyebrow)").innerHTML = connectedCount
    ? t("monitoredSummary", { count:connectedCount })
    : t("overviewConnectForMetrics");
  insight.querySelector("button").textContent = t("overviewViewAccounts");
  insight.querySelector("button").dataset.targetView = "accounts";
  const platformOrder = orderedProviderIds(accounts);
  els.platformCards.innerHTML = platformOrder.map(id => [id, providers[id]]).filter(([,provider]) => provider).map(([id,p]) => {
    const product = p.products[p.primaryProduct] || remotePlaceholder(p.name, false);
    const connectedAccounts = accounts.filter(account => account.provider === id);
    const isRemote = connectedAccounts.length > 0;
    const platformFreshness = overallFreshness(connectedAccounts);
    const freshnessClass = !isRemote ? "none" : platformFreshness.monitored === 0 ? "paused" : platformFreshness.attention ? "attention" : "fresh";
    const freshnessLabel = !isRemote ? "—" : platformFreshness.monitored === 0 ? t("healthPaused") : platformFreshness.attention ? t("refreshAccounts", { count:platformFreshness.attention }) : t("dataFresh");
    const productLabel = isRemote ? `${connectedAccounts.length} ${t("monitoredAccounts")} · ${product.name}` : t("noRemoteData");
    return `<article class="platform-card ${isRemote ? 'real-data' : 'remote-empty'}" data-provider="${escapeHtml(id)}" data-sort-provider="${escapeHtml(id)}" style="${providerStyle(id)}">
      <div class="platform-card-top">${platformLogo(id, "card-brand-logo")}<span><i class="status-dot ${freshnessClass}" title="${escapeHtml(freshnessLabel)}"></i><i class="drag-handle" data-drag-provider="${escapeHtml(id)}" title="${t("dragPlatformToSort")}" aria-label="${t("dragPlatformToSort")}">⋮⋮</i></span></div>
      <h4>${escapeHtml(localizeRemoteCopy(p.name))}</h4><div class="product-name">${escapeHtml(localizeRemoteCopy(productLabel))}</div>
      <div class="usage-row"><strong>${escapeHtml(isRemote ? product.usage : "—")}</strong><span>${escapeHtml(isRemote ? localizeRemoteCopy(product.usageLabel) : t("notConnected"))}</span></div>
      <div class="progress"><i style="--progress:${isRemote ? product.progress : 0}%"></i></div>
      <div class="platform-card-foot"><span>${escapeHtml(isRemote ? localizeRemoteCopy(product.reset) : t("syncAfterConnection"))}</span><span class="freshness-text ${freshnessClass}">${escapeHtml(freshnessLabel)}</span></div>
    </article>`;
  }).join("");
  if (!els.platformCards.children.length) {
    els.platformCards.innerHTML = `<article class="overview-platform-empty glass-panel"><span>＋</span><div><b>${t("noConnectedPlatform")}</b><p>${t("addPlatformInstruction")}</p></div><button class="soft-button" data-target-view="accounts">${t("goToAccounts")}</button></article>`;
  }
  els.activityList.innerHTML = accounts.length ? accounts.map(account => {
    const provider = providers[account.provider];
    const primary = ["deepseek", "kimi", "siliconflow", "openrouter"].includes(account.provider)
      ? account.balances?.[0]
      : account.products?.[0];
    const value = ["deepseek", "kimi", "siliconflow", "openrouter"].includes(account.provider)
      ? (primary ? escapeHtml(`${moneySymbol(primary.currency)} ${primary.total}`) : "—")
      : escapeHtml(primary?.usage || "—");
    const freshness = accountFreshness(account); return `<div class="activity-item">${platformLogo(account.provider, "activity-brand-logo")}<div class="activity-main"><b>${escapeHtml(accountDisplayName(account))}</b><span>${escapeHtml(provider?.name || account.provider)} · ${t("remoteSync")}</span></div><div class="activity-value"><b>${value}</b><span class="freshness-text ${freshness.level}">${escapeHtml(freshness.label)} · ${escapeHtml(relativeSyncTime(account.lastSync))}</span></div></div>`;
  }).join("") : `<div class="history-empty">${t("activityAfterSync")}</div>`;
}

function renderActionCenter() {
  const alerts = actionableAlerts();
  const priority = { sync:0, freshness:1, status:1, balance:2, quota:2 };
  const symbols = { sync:"!", freshness:"↻", status:"!", balance:"¥", quota:"%" };
  const items = alerts.slice().sort((left, right) => (priority[left.kind] ?? 3) - (priority[right.kind] ?? 3)).slice(0, 3);
  els.actionCenterTitle.textContent = items.length ? t("actionItems", { count:items.length }) : t("overviewNothingToDo");
  els.actionList.innerHTML = items.length ? items.map(item => {
    const account = (state.backend.accounts || []).find(candidate => candidate.id === item.accountId);
    const canSync = account && ["sync", "freshness", "status"].includes(item.kind);
    const actions = canSync
      ? `<button class="mini-button" data-sync-account="${escapeHtml(account.id)}"><span>${t("actionSyncNow")}</span></button><button class="mini-button" data-view-account="${escapeHtml(account.id)}" data-account-provider="${escapeHtml(account.provider)}">${t("actionViewAccount")}</button>`
      : `<button class="mini-button" data-target-view="alerts">${t("overviewViewAlerts")}</button>${account ? `<button class="mini-button" data-account-alerts="${escapeHtml(account.id)}">${t("actionAdjustRules")}</button>` : ""}`;
    const resetAt = item.kind === "quota" ? productResetAt(account, item.productId) : null;
    const detail = `${localizedAlertMessage(item)}${resetAt ? ` · ${t("predictedRestore", { time:relativeFutureTime(resetAt) })}` : ""}`;
    return `<article class="action-item"><span class="action-symbol ${["sync", "freshness", "status"].includes(item.kind) ? "sync" : ""}">${symbols[item.kind] || "!"}</span><div class="action-copy"><b>${escapeHtml(localizedAlertTitle(item))}</b><span>${escapeHtml(detail)}</span></div><div class="action-actions">${actions}</div></article>`;
  }).join("") : `<article class="action-item"><span class="action-symbol good">✓</span><div class="action-copy"><b>${t("actionNothingImmediate")}</b><span>${t("snoozedAlertNote")}</span></div></article>`;
}

function renderPlatform() {
  const id = state.provider, provider = providers[id], account = getSelectedAccount(id);
  if (!provider) {
    state.provider = "openai";
    return renderPlatform();
  }
  if (id === "deepseek") applyDeepSeekAccountData(account);
  if (id === "kimi") applyKimiAccountData(account);
  if (id === "siliconflow") applySiliconFlowAccountData(account);
  if (id === "bailian") applyBailianAccountData(account);
  if (id === "openrouter") applyOpenRouterAccountData(account);
  if (id === "openai") applyOpenAIAccountData(account);
  if (id === "volcengine") applyVolcengineAccountData(account);
  if (id === "mimo") applyMimoAccountData(account);
  let productId = state.products[id];
  let product = provider.products[productId];
  if (!product) {
    productId = Object.keys(provider.products)[0] || "remote";
    product = provider.products[productId] || remotePlaceholder(provider.name, Boolean(account));
    state.products[id] = productId;
  }
  els.selectedPlatformIcon.innerHTML = platformLogo(id, "large-brand-logo");
  els.selectedPlatformIcon.removeAttribute("style");
  els.selectedPlatformName.textContent = account ? accountDisplayName(account) : provider.name;
  const warningSuffix = account?.productErrors?.length ? t("platformUnauthorizedProducts", { count: account.productErrors.length }) : "";
  els.selectedPlatformDescription.textContent = account ? t("platformAccountDescription", { provider: provider.name, hint: account.keyHint, warning: warningSuffix }) : provider.description;
  const connectionBadge = document.querySelector(".connected-badge");
  const isConnected = Boolean(account);
  const freshness = accountFreshness(account); connectionBadge.textContent = isConnected ? freshness.label : t("notConnected");
  connectionBadge.classList.toggle("offline", !isConnected); connectionBadge.dataset.freshness = isConnected ? freshness.level : "none";
  document.querySelector(".header-stat strong").textContent = isConnected ? relativeSyncTime(account.lastSync) : "—";
  els.productTabs.innerHTML = Object.entries(provider.products).map(([pid,p]) => `<button class="${pid===productId?'active':''}" data-product="${escapeHtml(pid)}">${escapeHtml(p.name)}</button>`).join("");
  els.productSummary.innerHTML = product.summaries.map(([label,value,note]) => `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  els.detailEyebrow.textContent = product.kind;
  els.detailTitle.textContent = t("detailRemoteMetrics", { name: product.name });
  renderDynamicTable(product);
  els.exportProductButton.disabled = !account || !(product.rows || []).length;
  renderMetricTrend(account, productId);
}

function metricHistoryKey(account, productId) {
  return `${account.id}|${productId}|${state.metricRangeDays}|${account.lastSync || "never"}`;
}

function formatMetricNumber(value, unit = "") {
  const number = Number(value);
  const formatted = Number.isFinite(number)
    ? window.PrismeterI18n.formatNumber(number, { maximumFractionDigits:Math.abs(number) < 10 ? 2 : 1 })
    : "—";
  if (unit === "CNY") return `¥ ${formatted}`;
  if (unit === "USD") return `$ ${formatted}`;
  return `${formatted}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}

function clearMetricTrend(message) {
  els.trendPath.setAttribute("d", "");
  els.trendArea.setAttribute("d", "");
  els.trendPoints.innerHTML = "";
  els.trendChange.textContent = t("collecting");
  els.trendChange.classList.remove("down");
  els.trendEmpty.textContent = message;
  els.trendEmpty.hidden = false;
  renderTrendForecast(null);
}

function forecastDuration(milliseconds) {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  if (minutes < 60) return t("minutes", { count:minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("hours", { count:hours });
  return t("days", { count:Math.round(hours / 24) });
}

function estimateMetricExhaustion(snapshots, metric, resetAt) {
  if (snapshots.length < 3) return { state:"collecting", title:t("forecastCollecting", { count:3 - snapshots.length }), detail:t("forecastNeedSamples"), meta:t("forecastNotStarted") };
  const first = snapshots[0], last = snapshots.at(-1);
  const elapsed = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
  const delta = Number(last.value) - Number(first.value);
  if (!Number.isFinite(elapsed) || elapsed < 30 * 60 * 1000 || !Number.isFinite(delta)) {
    return { state:"collecting", title:t("forecastKeepCollecting"), detail:t("forecastShortSpan"), meta:t("forecastNotStarted") };
  }
  const isQuota = metric.unit === "%";
  const isBalance = ["CNY", "USD"].includes(metric.unit);
  const consumption = isQuota ? delta : isBalance ? -delta : 0;
  const target = isQuota ? 100 : 0;
  const remaining = isQuota ? target - Number(last.value) : Number(last.value);
  if (!isQuota && !isBalance) return { state:"unsupported", title:t("forecastUnsupported"), detail:t("forecastUnsupportedDetail"), meta:t("forecastHistoryOnly") };
  if (remaining <= 0) return { state:"risk", title:isQuota ? t("forecastQuotaExhausted") : t("forecastBalanceExhausted"), detail:t("forecastCheckRemote"), meta:t("forecastRemoteSource") };
  if (consumption <= 0) return { state:"steady", title:t("forecastNoConsumption"), detail:t("forecastNoConsumptionDetail"), meta:t("forecastUpdates") };
  const untilExhausted = remaining / consumption * elapsed;
  if (!Number.isFinite(untilExhausted) || untilExhausted > 90 * 86400000) return { state:"steady", title:t("forecastLowConsumption"), detail:t("forecastLongHorizon"), meta:t("forecastUpdates") };
  const estimatedAt = new Date(new Date(last.timestamp).getTime() + untilExhausted);
  const resetTime = resetAt ? new Date(resetAt).getTime() : NaN;
  const beforeReset = Number.isFinite(resetTime) && estimatedAt.getTime() < resetTime;
  const rate = consumption / (elapsed / 3600000);
  const rateText = isQuota ? t("forecastRatePercent", { rate:rate.toFixed(1) }) : t("forecastRateValue", { rate:formatMetricNumber(rate, metric.unit) });
  if (beforeReset) return { state:"risk", title:t("forecastExhaustsIn", { duration:forecastDuration(untilExhausted) }), detail:t("forecastBeforeReset", { count:snapshots.length, rate:rateText }), meta:t("forecastRestores", { time:relativeFutureTime(resetAt) }) };
  if (Number.isFinite(resetTime)) return { state:"healthy", title:t("forecastResetFirst"), detail:t("forecastResetFirstDetail", { count:snapshots.length, rate:rateText }), meta:t("forecastRestores", { time:relativeFutureTime(resetAt) }) };
  return { state:"attention", title:t("forecastExhaustsIn", { duration:forecastDuration(untilExhausted) }), detail:t("forecastEstimate", { count:snapshots.length, rate:rateText }), meta:t("forecastAt", { time:formatDate(estimatedAt) }) };
}

function trendForecastIconSvg(state) {
  const paths = {
    collecting:'<circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.5l3 1.8"/>',
    unsupported:'<circle cx="12" cy="12" r="7.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    steady:'<path d="M5 12h14"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    healthy:'<circle cx="12" cy="12" r="7.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    attention:'<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>',
    risk:'<path d="M12 4.5 20 19H4L12 4.5Z"/><path d="M12 9v4.5"/><path d="M12 16.5h.01"/>'
  };
  return `<svg viewBox="0 0 24 24">${paths[state] || paths.collecting}</svg>`;
}

function renderTrendForecast(forecast) {
  if (!forecast) { els.trendForecast.hidden = true; return; }
  els.trendForecast.hidden = false;
  els.trendForecast.dataset.state = forecast.state;
  els.trendForecastIcon.innerHTML = trendForecastIconSvg(forecast.state);
  els.trendForecastTitle.textContent = forecast.title;
  els.trendForecastDetail.textContent = forecast.detail;
  els.trendForecastMeta.textContent = forecast.meta;
}

async function loadMetricHistory(account, productId, key) {
  if (state.metricHistoryRequestKey === key) return;
  state.metricHistoryRequestKey = key;
  try {
    const payload = await apiRequest("/api/metric-history", {
      method:"POST",
      body:JSON.stringify({ accountId:account.id, productId, rangeDays:state.metricRangeDays })
    });
    state.metricHistoryCache.set(key, payload.snapshots || []);
  } catch (error) {
    state.metricHistoryCache.set(key, { error:errorMessage(error) });
  } finally {
    if (state.metricHistoryRequestKey === key) state.metricHistoryRequestKey = "";
    const current = getSelectedAccount(state.provider);
    if (current?.id === account.id && state.products[state.provider] === productId) renderMetricTrend(account, productId);
  }
}

function renderMetricTrend(account, productId) {
  if (!account || account.provider === "mimo" || productId === "remote") {
    els.balanceTrendCard.hidden = true;
    return;
  }
  els.balanceTrendCard.hidden = false;
  document.querySelectorAll("[data-trend-range]").forEach(button => {
    const active = Number(button.dataset.trendRange) === state.metricRangeDays;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const key = metricHistoryKey(account, productId);
  const cached = state.metricHistoryCache.get(key);
  if (!cached) {
    els.trendMetricTabs.innerHTML = "";
    els.trendCaption.textContent = t("trendLoading", { days:state.metricRangeDays });
    clearMetricTrend(t("trendLoadingDetail"));
    loadMetricHistory(account, productId, key);
    return;
  }
  if (cached.error) {
    els.trendMetricTabs.innerHTML = "";
    els.trendCaption.textContent = t("trendFailed");
    clearMetricTrend(cached.error);
    return;
  }
  const groups = new Map();
  for (const item of cached) {
    if (!groups.has(item.metricId)) groups.set(item.metricId, []);
    groups.get(item.metricId).push(item);
  }
  const metrics = [...groups.entries()].map(([id,items]) => ({ id, label:items[0].label, unit:items[0].unit, items }));
  const selectionKey = `${account.id}|${productId}`;
  let selectedId = state.metricSelections[selectionKey];
  if (!metrics.some(metric => metric.id === selectedId)) selectedId = metrics[0]?.id || "";
  state.metricSelections[selectionKey] = selectedId;
  els.trendMetricTabs.innerHTML = metrics.map(metric => {
    const label = localizeMetricHistoryLabel(metric.label);
    return `<button type="button" class="${metric.id === selectedId ? "active" : ""}" data-trend-metric="${escapeHtml(metric.id)}" title="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
  }).join("");
  const selected = metrics.find(metric => metric.id === selectedId);
  if (!selected) {
    els.trendCaption.textContent = t("trendNoValues", { days:state.metricRangeDays });
    clearMetricTrend(t("trendNoMetrics"));
    return;
  }
  const snapshots = selected.items.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  renderTrendForecast(estimateMetricExhaustion(snapshots, selected, productResetAt(account, productId)));
  els.trendCaption.textContent = t("trendSummary", { count:snapshots.length, days:state.metricRangeDays });
  if (snapshots.length < 2) {
    clearMetricTrend(t("trendNeedTwoSyncs"));
    return;
  }
  const values = snapshots.map(item => Number(item.value));
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((value,index) => ({
    x:20 + index * (560 / Math.max(values.length - 1, 1)),
    y:140 - ((value - min) / range) * 110,
    value,
    timestamp:snapshots[index].timestamp
  }));
  const line = points.map((point,index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  els.trendPath.setAttribute("d", line);
  els.trendArea.setAttribute("d", `${line} L580,155 L20,155 Z`);
  els.trendPoints.innerHTML = points.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>${escapeHtml(formatDate(point.timestamp))} · ${escapeHtml(formatMetricNumber(point.value, selected.unit))}</title></circle>`).join("");
  const change = values.at(-1) - values[0];
  els.trendChange.textContent = selected.unit === "%"
    ? t("percentagePoints", { sign:change > 0 ? "+" : "", value:change.toFixed(1) })
    : `${change > 0 ? "+" : ""}${formatMetricNumber(change, selected.unit)}`;
  els.trendChange.classList.toggle("down", change < 0);
  els.trendEmpty.hidden = true;
}

function formatSyncSetting() {
  const minutes = state.backend.settings?.autoSyncMinutes || 0;
  return minutes ? t("autoSyncEvery", { minutes }) : t("autoSyncOff");
}

async function syncDesktopPreferences(settings = state.backend.settings, strictKeys = [], requestedKeys = null) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  const desired = {
    closeToTray:settings?.closeToTray !== false,
    launchAtStartup:Boolean(settings?.launchAtStartup)
  };
  const commands = {
    closeToTray:"set_close_to_tray",
    launchAtStartup:"set_launch_on_startup"
  };
  const keys = requestedKeys || Object.keys(commands);
  for (const key of keys) {
    if (state.desktopPreferences[key] === desired[key]) continue;
    try {
      await withTimeout(invoke(commands[key], { value:desired[key] }), 2000, `Desktop preference ${key}`);
      state.desktopPreferences[key] = desired[key];
    } catch (error) {
      console.error(`应用桌面设置 ${key} 失败`, error);
      if (strictKeys.includes(key)) throw new Error(errorMessage(error, t("desktopPreferenceFailed")));
    }
  }
}

function populateSettings() {
  const settings = state.backend.settings;
  if (!settings) return;
  setComboboxValue(els.interfaceLanguage, settings.interfaceLanguage || "zh-CN", false);
  setComboboxValue(els.appearanceMode, settings.appearanceMode || "system", false);
  setComboboxValue(els.autoSyncMinutes, String(settings.autoSyncMinutes), false);
  setComboboxValue(els.staleAfterMinutes, String(settings.staleAfterMinutes || 0), false);
  setComboboxValue(els.updateCheckMode, settings.updateCheckMode || "startup", false);
  setComboboxValue(els.historyRetentionDays, String(settings.historyRetentionDays || 90), false);
  els.lowBalanceThreshold.value = settings.lowBalanceThreshold;
  els.usageThreshold.value = settings.usageThreshold || 80;
  els.notificationsEnabled.checked = settings.notificationsEnabled;
  els.syncOnStartup.checked = Boolean(settings.syncOnStartup);
  els.closeToTray.checked = settings.closeToTray !== false;
  els.launchAtStartup.checked = Boolean(settings.launchAtStartup);
  els.updateCurrentVersion.textContent = state.backend.version || "—";
  const storage = state.backend.historyStorage || {};
  const balanceSnapshots = Number(storage.balanceSnapshots || 0);
  const metricSnapshots = Number(storage.metricSnapshots || 0);
  const syncEvents = Number(storage.syncEvents || 0);
  els.historyStorageSummary.textContent = t("historyStorageSummary", { count: balanceSnapshots + metricSnapshots + syncEvents });
  els.historyStorageDetail.textContent = t("historyStorageDetail", { metrics: metricSnapshots, balances: balanceSnapshots, syncs: syncEvents });
  els.clearHistoryButton.disabled = balanceSnapshots + metricSnapshots + syncEvents === 0;
}

function closeComboboxes(except) {
  document.querySelectorAll("[data-combobox].open").forEach(combo => {
    if (combo === except) return;
    combo.classList.remove("open");
    combo.querySelector("[data-combo-trigger]")?.setAttribute("aria-expanded", "false");
    const menu = combo.querySelector(".combo-menu");
    menu?.classList.remove("combo-menu-floating");
    if (menu) menu.removeAttribute("style");
  });
}

function positionComboboxMenu(combo) {
  const trigger = combo?.querySelector("[data-combo-trigger]");
  const menu = combo?.querySelector(".combo-menu");
  if (!trigger || !menu || !combo.classList.contains("open")) return;
  const viewportPadding = 12;
  const gap = 8;
  const triggerRect = trigger.getBoundingClientRect();
  const width = Math.min(Math.max(triggerRect.width, 400), window.innerWidth - viewportPadding * 2);
  const left = Math.min(Math.max(viewportPadding, triggerRect.left), window.innerWidth - viewportPadding - width);
  const options = [...menu.querySelectorAll(".combo-option")];
  const needsScrolling = options.length > 5;
  menu.classList.add("combo-menu-floating");
  menu.classList.toggle("combo-menu-scrollable", needsScrolling);
  menu.style.setProperty("--combo-menu-width", `${width}px`);
  menu.style.left = `${left}px`;
  menu.style.visibility = "hidden";
  menu.style.maxHeight = "none";
  requestAnimationFrame(() => {
    if (!combo.classList.contains("open")) return;
    const menuStyle = getComputedStyle(menu);
    const rowGap = Number.parseFloat(menuStyle.rowGap) || 0;
    const chromeHeight = (Number.parseFloat(menuStyle.paddingTop) || 0)
      + (Number.parseFloat(menuStyle.paddingBottom) || 0)
      + (Number.parseFloat(menuStyle.borderTopWidth) || 0)
      + (Number.parseFloat(menuStyle.borderBottomWidth) || 0);
    const visibleOptions = needsScrolling ? options.slice(0, 5) : options;
    const fiveRowHeight = visibleOptions.reduce((height, option) => height + option.getBoundingClientRect().height, 0)
      + Math.max(0, visibleOptions.length - 1) * rowGap
      + chromeHeight;
    const desiredHeight = needsScrolling ? Math.min(menu.scrollHeight, fiveRowHeight) : menu.scrollHeight;
    const below = window.innerHeight - triggerRect.bottom - gap - viewportPadding;
    const above = triggerRect.top - gap - viewportPadding;
    const openAbove = below < Math.min(desiredHeight, 180) && above > below;
    const available = Math.max(120, openAbove ? above : below);
    const maxHeight = Math.min(desiredHeight, available);
    const top = openAbove
      ? Math.max(viewportPadding, triggerRect.top - gap - maxHeight)
      : Math.min(window.innerHeight - viewportPadding - maxHeight, triggerRect.bottom + gap);
    menu.style.top = `${top}px`;
    menu.style.setProperty("--combo-menu-max-height", `${maxHeight}px`);
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.visibility = "visible";
  });
}

function setComboboxValue(input, value, dispatch = true) {
  if (!input) return;
  const combo = input.closest("[data-combobox]");
  const option = [...combo.querySelectorAll(".combo-option[data-value]")].find(item => item.dataset.value === String(value));
  input.value = String(value);
  combo.querySelectorAll(".combo-option").forEach(item => item.classList.toggle("selected", item === option));
  if (option) combo.querySelector("[data-combo-label]").textContent = option.childNodes[0].textContent.trim();
  if (dispatch) input.dispatchEvent(new Event("change", { bubbles:true }));
}

function updateCredentialFields() {
  const provider = els.accountProvider.value;
  const isVolcengine = provider === "volcengine";
  const isOpenAI = provider === "openai";
  const isMimo = provider === "mimo";
  const isKimi = provider === "kimi";
  const isSiliconFlow = provider === "siliconflow";
  const isBailian = provider === "bailian";
  const isOpenRouter = provider === "openrouter";
  els.deepseekCredentials.hidden = isVolcengine || isOpenAI || isMimo;
  els.volcengineCredentials.hidden = !isVolcengine;
  els.openaiCredentials.hidden = !isOpenAI;
  els.mimoCredentials.hidden = !isMimo;
  els.deepseekCapability.hidden = isVolcengine || isOpenAI || isMimo || isKimi || isSiliconFlow || isBailian || isOpenRouter;
  els.kimiCapability.hidden = !isKimi;
  els.siliconflowCapability.hidden = !isSiliconFlow;
  els.bailianCapability.hidden = !isBailian;
  els.openrouterCapability.hidden = !isOpenRouter;
  els.volcengineCapability.hidden = !isVolcengine;
  els.openaiCapability.hidden = !isOpenAI;
  els.mimoCapability.hidden = !isMimo;
  els.accountKey.required = !isVolcengine && !isOpenAI && !isMimo;
  els.volcAccessKey.required = isVolcengine;
  els.volcSecretKey.required = isVolcengine;
  els.mimoApiKey.required = isMimo;
  els.accountName.placeholder = isVolcengine ? t("accountPlaceholderVolcengine") : isOpenAI ? t("accountPlaceholderOpenAi") : isMimo ? t("accountPlaceholderMimo") : isKimi ? t("accountPlaceholderKimi") : isSiliconFlow ? t("accountPlaceholderSiliconFlow") : isBailian ? t("accountPlaceholderBailian") : isOpenRouter ? t("accountPlaceholderOpenRouter") : t("accountNamePlaceholder");
  syncMimoEndpointPresets();
}

function syncMimoEndpointPresets(targetId = "mimoBaseUrl") {
  const current = (els[targetId]?.value || "").trim().replace(/\/$/, "");
  document.querySelectorAll(`[data-mimo-target="${targetId}"]`).forEach(button => {
    button.classList.toggle("selected", button.dataset.mimoBaseUrl === current);
  });
}

function openConnectionDialog(account) {
  if (!account || account.provider === "openai") return;
  state.connectionAccountId = account.id;
  els.connectionDialogTitle.textContent = t("connectionDialogTitle", { name: accountDisplayName(account) });
  els.connectionDialogSubtitle.textContent = `${providers[account.provider]?.name || account.provider} · ${account.keyHint || t("connectionCredentialSaved")}`;
  els.editDeepseekCredentials.hidden = !["deepseek", "kimi", "siliconflow", "bailian", "openrouter"].includes(account.provider);
  els.editVolcengineCredentials.hidden = account.provider !== "volcengine";
  els.editMimoCredentials.hidden = account.provider !== "mimo";
  els.editAccountKey.value = "";
  els.editVolcAccessKey.value = "";
  els.editVolcSecretKey.value = "";
  els.editVolcRegion.value = account.region || APP_DEFAULTS.volcengineRegion;
  els.editVolcProject.value = account.projectName || APP_DEFAULTS.volcengineProject;
  els.editMimoApiKey.value = "";
  els.editMimoBaseUrl.value = account.baseUrl || APP_DEFAULTS.mimoPaygUrl;
  syncMimoEndpointPresets("editMimoBaseUrl");
  els.connectionDialog.showModal();
}

function renderDynamicTable(product) {
  const columns = product.columns || [];
  const productRows = product.rows || [];
  if (!columns.length || !productRows.length) {
    els.dynamicTable.innerHTML = `<div class="history-empty"><b>${escapeHtml(product.name)}</b><br>${escapeHtml(t("tableNoPublicDetails"))}</div>`;
    return;
  }
  const header = `<div class="data-row header" style="--columns:${columns.length}"><span>${t("tableModelCapability")}</span>${columns.map(c=>`<span>${escapeHtml(c)}</span>`).join("")}<span></span></div>`;
  const rows = productRows.map((row, index) => `<div class="data-row" data-row="${index}" style="--columns:${columns.length}">
    <div class="resource-cell"><div class="resource-badge">${escapeHtml(row.badge)}</div><div><b>${escapeHtml(row.name)}</b><span>${escapeHtml(row.type)}</span></div></div>
    ${row.metrics.map(([v,u])=>`<div class="metric-cell"><b>${escapeHtml(v)}</b><span>${escapeHtml(u)}</span></div>`).join("")}<span class="chevron">›</span>
  </div>`).join("");
  els.dynamicTable.innerHTML = header + rows;
}

function modelFamilyDefinition(id) {
  return {
    all:{ label:t("modelsAllModels"), aliases:[] },
    deepseek:{ label:"DeepSeek", aliases:["deepseek","深度求索"] },
    glm:{ label:"GLM", aliases:["glm","智谱"] },
    doubao:{ label:"Doubao", aliases:["doubao","豆包"] },
    mimo:{ label:"MiMo", aliases:["mimo","xiaomi","小米"] },
    gpt:{ label:"GPT / Codex", aliases:["gpt","codex","chatgpt","openai"] }
  }[id] || { label:id, aliases:[id] };
}

function matchesModelFamily(value, definition) {
  const text = String(value || "").toLocaleLowerCase();
  return definition.aliases.some(alias => text.includes(alias));
}

function collectRemoteModelRecords(familyId, levelFilter = "all", query = "") {
  const definition = modelFamilyDefinition(familyId);
  const includeAll = familyId === "all";
  const accounts = state.backend.accounts || [];
  const familyRecords = [];
  for (const account of accounts) {
    for (const product of account.products || []) {
      const productMatches = includeAll || matchesModelFamily(product.name, definition) || matchesModelFamily(product.kind, definition) || matchesModelFamily(product.id, definition);
      const matchedRows = (product.rows || []).filter(row => includeAll || matchesModelFamily(row.name, definition) || matchesModelFamily(row.type, definition));
      for (const row of matchedRows) {
        familyRecords.push({ account, product, row, level:"row" });
      }
      if (productMatches) familyRecords.push({ account, product, row:null, level:"product" });
    }
  }
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const records = familyRecords.filter(record => {
    if (levelFilter !== "all" && record.level !== levelFilter) return false;
    if (!normalizedQuery) return true;
    const provider = providers[record.account.provider];
    return [provider?.name, accountDisplayName(record.account), record.product.name, record.product.kind, record.row?.name, record.row?.type]
      .some(value => String(value || "").toLocaleLowerCase().includes(normalizedQuery));
  });
  return { definition, accounts, familyRecords, records };
}

function renderComparisons() {
  const familyId = els.modelFamilySelect.value;
  const levelFilter = els.modelLevelSelect.value;
  const query = els.modelSearchInput.value;
  const { definition, accounts, familyRecords, records } = collectRemoteModelRecords(familyId, levelFilter, query);
  const connectedProviderIds = [...new Set(accounts.map(account => account.provider))];
  const coveredProviderIds = [...new Set(familyRecords.map(record => record.account.provider))];
  const rowCount = records.filter(record => record.level === "row").length;
  const productCount = records.filter(record => record.level === "product").length;
  els.modelTotal.textContent = String(records.length);
  els.modelRowTotal.textContent = String(rowCount);
  els.modelProductTotal.textContent = String(productCount);
  els.modelTotalUnit.textContent = records.length ? t("modelsFilteredResult", { family: definition.label }) : t("modelsNoMatchingResult", { family: definition.label });
  els.mainSource.textContent = connectedProviderIds.length ? t("modelCoveredPlatforms", { covered:coveredProviderIds.length, total:connectedProviderIds.length }) : t("noConnectedPlatform");
  const latestSync = accounts.map(account => account.lastSync).filter(Boolean).sort().at(-1);
  els.modelLatestSync.textContent = latestSync ? relativeSyncTime(latestSync) : t("modelsNeverSynced");
  els.modelResultCount.textContent = t("modelResultUnit", { count:records.length });
  els.modelResultsTitle.textContent = query.trim() ? t("modelResultsFor", { query:query.trim() }) : `${definition.label} · ${levelFilter === "row" ? t("modelRowRecords") : levelFilter === "product" ? t("modelProductRecords") : t("modelAllRecords")}`;

  els.modelCoverage.innerHTML = connectedProviderIds.map(id => {
    const providerAccounts = accounts.filter(account => account.provider === id);
    const providerRecords = familyRecords.filter(record => record.account.provider === id);
    const rows = providerRecords.filter(record => record.level === "row").length;
    const products = providerRecords.filter(record => record.level === "product").length;
    const paused = providerAccounts.filter(account => account.enabled === false).length;
    return `<article class="glass-panel model-coverage-item ${providerRecords.length ? "covered" : "uncovered"}">
      ${platformLogo(id, "activity-brand-logo")}<div><b>${escapeHtml(providers[id]?.name || id)}</b><span>${t("modelProviderAccounts", { count:providerAccounts.length, paused:paused ? t("modelPausedSuffix", { count:paused }) : "" })}</span></div>
      <strong>${providerRecords.length ? t("modelLevelSummary", { rows, products }) : t("modelNoFields", { family:definition.label })}</strong>
    </article>`;
  }).join("");

  if (!accounts.length) {
    els.modelCoverage.innerHTML = "";
    els.comparisonCards.innerHTML = `<article class="comparison-card remote-empty"><div class="comparison-card-top"><div><h4>${t("modelConnectTitle")}</h4><span>${t("modelConnectDetail")}</span></div></div><button class="soft-button model-account-link" data-target-view="accounts">${t("goToAccounts")}</button></article>`;
    return;
  }

  const cards = records.map(record => {
    const provider = providers[record.account.provider];
    const productI18n = record.product.i18n || {};
    const rowI18n = record.row?.i18n || {};
    const productName = i18nField(record.product.name, record.product.nameKey || productI18n.nameKey);
    const rowName = record.row && i18nField(record.row.name, record.row.nameKey || rowI18n.nameKey);
    const productKind = i18nField(record.product.kind, record.product.kindKey || productI18n.kindKey);
    const usageLabel = i18nField(record.product.usageLabel, record.product.usageLabelKey || productI18n.usageLabelKey, record.product.usageLabelParams || productI18n.usageLabelParams);
    const metricItems = record.row
      ? (record.row.metrics || []).slice(0, 4).map((metric,index) => ({
        label:i18nField((record.product.columns || [])[index] || t("metricFallback", { count:index + 1 }), productI18n.columnKeys?.[index]),
        value:i18nField(metric.value, rowI18n.metricValueKeys?.[index], rowI18n.metricValueParams?.[index]) || "—",
        unit:i18nField(metric.unit || t("remote"), rowI18n.metricUnitKeys?.[index])
      }))
      : (record.product.summaries || []).slice(0, 4).map((metric, index) => {
        const keys = productI18n.summaryKeys?.[index] || metric;
        return {
          label:i18nField(metric.label || t("remoteMetrics"), keys.labelKey),
          value:i18nField(metric.value || "—", keys.valueKey, keys.valueParams),
          unit:i18nField(metric.note || t("platformReturned"), keys.noteKey, keys.noteParams)
        };
      });
    if (!metricItems.length) metricItems.push(
      { label:usageLabel || t("remoteUsage"), value:record.product.usage || "—", unit:productKind || t("officialProduct") },
      { label:t("productStatus"), value:record.product.status || t("normal"), unit:t("platformReturned") }
    );
    const freshness = accountFreshness(record.account);
    return '<article class="comparison-card remote-model-card">' +
      '<div class="model-source-head">' + platformLogo(record.account.provider, "activity-brand-logo") + '<div><h4>' + escapeHtml(rowName || productName || definition.label) + '</h4><span>' + escapeHtml(provider?.name || record.account.provider) + ' · ' + escapeHtml(accountDisplayName(record.account)) + ' · ' + escapeHtml(productName || t("remoteProduct")) + '</span></div><span class="model-level-badge ' + record.level + '">' + (record.level === "row" ? t("modelRowRecords") : t("modelProductRecords")) + '</span></div>' +
      '<div class="model-metrics">' + metricItems.map(metric => '<div><span>' + escapeHtml(metric.label) + '</span><strong>' + escapeHtml(metric.value) + '</strong><small>' + escapeHtml(metric.unit) + '</small></div>').join("") + '</div>' +
      '<div class="model-record-foot"><span class="freshness-text ' + freshness.level + '">' + escapeHtml(freshness.label) + ' · ' + escapeHtml(relativeSyncTime(record.account.lastSync)) + '</span><button class="text-button" data-view-account="' + escapeHtml(record.account.id) + '" data-account-provider="' + escapeHtml(record.account.provider) + '">' + t("viewAccountData") + '</button></div>' +
    '</article>';
  });
  const uncovered = connectedProviderIds.filter(id => !coveredProviderIds.includes(id)).map(id => providers[id]?.name || id);
  const note = familyId !== "all" && uncovered.length ? '<article class="comparison-coverage-note"><b>' + escapeHtml(uncovered.join("、")) + '</b><span>' + escapeHtml(t("modelsCoverageMissing", { family: definition.label })) + '</span></article>' : "";
  const emptyReason = query.trim() ? t("modelsSearchEmpty", { query: query.trim() }) : t("modelsFilterEmpty", { providers: connectedProviderIds.map(id => providers[id]?.name || id).join("、") });
  els.comparisonCards.innerHTML = cards.length ? cards.join("") + note : '<article class="comparison-card remote-empty"><div class="comparison-card-top"><div><h4>' + escapeHtml(t("modelsNoMatchesTitle", { family: definition.label })) + '</h4><span>' + escapeHtml(emptyReason) + ' ' + escapeHtml(t("modelsNoLocalFill")) + '</span></div></div></article>' + note;
}

function renderAlerts() {
  const accounts = state.backend.accounts || [];
  const allAlerts = state.backend.alerts || [];
  const category = item => ["sync", "freshness", "status"].includes(item.kind) ? "sync" : item.kind;
  const counts = {
    balance:allAlerts.filter(item => category(item) === "balance").length,
    quota:allAlerts.filter(item => category(item) === "quota").length,
    sync:allAlerts.filter(item => category(item) === "sync").length
  };
  els.alertTotal.textContent = String(allAlerts.length);
  els.alertBalanceTotal.textContent = String(counts.balance);
  els.alertQuotaTotal.textContent = String(counts.quota);
  els.alertSyncTotal.textContent = String(counts.sync);
  const ruleAccounts = accounts.filter(account => account.provider !== "mimo");
  const disabledRules = ruleAccounts.filter(account => account.alertSettings?.enabled === false).length;
  const customizedRules = ruleAccounts.filter(account => {
    const settings = account.alertSettings || {};
    return settings.lowBalanceThreshold != null || settings.usageThreshold != null || settings.staleAfterMinutes != null;
  }).length;
  els.alertRuleSummary.textContent = ruleAccounts.length
    ? t("alertRuleSummary", {
      enabled: ruleAccounts.length - disabledRules,
      disabled: disabledRules ? t("alertRuleDisabledCount", { count: disabledRules }) : "",
      customized: customizedRules ? t("alertRuleCustomizedCount", { count: customizedRules }) : ""
    })
    : t("alertsNoAccounts");
  els.alertRuleList.innerHTML = ruleAccounts.length ? ruleAccounts.map(account => {
    const settings = account.alertSettings || {};
    const disabled = settings.enabled === false;
    const overrides = [];
    if (settings.lowBalanceThreshold != null) overrides.push(t("alertBalanceOverride", { value:settings.lowBalanceThreshold }));
    if (settings.usageThreshold != null) overrides.push(t("alertQuotaOverride", { value:settings.usageThreshold }));
    if (settings.staleAfterMinutes != null) overrides.push(t("alertFreshnessOverride", { value:formatRuleDuration(settings.staleAfterMinutes) }));
    const stateLabel = disabled ? t("alertRuleDisabled") : overrides.length ? overrides.join(" · ") : t("alertRuleGlobal");
    return `<article class="alert-rule-item ${disabled ? "disabled" : overrides.length ? "custom" : "inherited"}">
      ${platformLogo(account.provider, "activity-brand-logo")}<div><b>${escapeHtml(accountDisplayName(account))}</b><span>${escapeHtml(stateLabel)}</span></div>
      <button type="button" class="mini-button" data-account-alerts="${escapeHtml(account.id)}">${disabled ? t("alertReenable") : t("actionAdjustRules")}</button>
    </article>`;
  }).join("") : `<div class="alert-rule-empty">${t("alertRuleSupport")}</div>`;
  document.querySelectorAll("[data-alert-filter]").forEach(button => {
    const active = button.dataset.alertFilter === state.alertFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const visibleAlerts = state.alertFilter === "all" ? allAlerts : allAlerts.filter(item => category(item) === state.alertFilter);
  const snoozedCount = visibleAlerts.filter(isAlertSnoozed).length;
  els.alertFilterResult.textContent = t("alertFilterSummary", { count:visibleAlerts.length, suffix:snoozedCount ? t("alertSnoozedCount", { count:snoozedCount }) : "" });
  const symbols = { balance:"¥", quota:"%", sync:"!", freshness:"↻", status:"!" };
  const badges = { balance:t("alertsBalance"), quota:t("alertsQuota"), sync:t("syncSettings"), freshness:t("alertsSyncFreshness"), status:t("remoteStatusAttention") };
  els.alertList.innerHTML = visibleAlerts.length ? visibleAlerts.map(item => {
    const account = (state.backend.accounts || []).find(candidate => candidate.id === item.accountId);
    const kind = category(item);
    const snoozed = isAlertSnoozed(item);
    const snoozeButton = item.alertKey ? `<button class="mini-button" ${snoozed ? "data-resume-alert" : "data-snooze-alert"}="${escapeHtml(item.alertKey)}">${snoozed ? t("alertResume") : t("alertSnooze")}</button>` : "";
    return `<article class="alert-item glass-panel live-alert ${kind}${snoozed ? " snoozed" : ""}" data-alert-kind="${kind}">
      <div class="alert-symbol">${symbols[item.kind] || "!"}</div>
      <div class="alert-copy"><div class="alert-title-row">${platformLogo(item.provider || account?.provider, "activity-brand-logo")}<div><h4>${escapeHtml(localizedAlertTitle(item))}</h4><span>${escapeHtml(providers[item.provider || account?.provider]?.name || t("platformConnected"))} · ${escapeHtml(account ? accountDisplayName(account) : item.accountName || t("accountName"))}</span></div></div><p>${escapeHtml(localizedAlertMessage(item))}</p></div>
      <div class="alert-side"><span class="official-alert${snoozed ? " snoozed" : ""}">${snoozed ? t("alertSnoozedUntil", { time:formatDate(item.snoozedUntil) }) : t("alertBadgeRemote", { kind:badges[item.kind] || t("alertsCenter") })}</span><div class="alert-actions">${snoozeButton}${account ? `<button class="mini-button" data-account-alerts="${escapeHtml(account.id)}">${t("actionAdjustRules")}</button><button class="mini-button" data-view-account="${escapeHtml(account.id)}" data-account-provider="${escapeHtml(account.provider)}">${t("viewAccountData")}</button><button class="mini-button alert-sync-button" data-sync-account="${escapeHtml(account.id)}"><span>${t("actionSyncNow")}</span></button>` : ""}</div></div>
    </article>`;
  }).join("") : allAlerts.length
    ? `<article class="alert-empty glass-panel"><div class="alert-symbol">✓</div><div><h4>${t("alertNoneInCategory")}</h4><p>${t("alertNoneInCategoryDetail")}</p></div></article>`
    : accounts.length
      ? `<article class="alert-empty glass-panel good"><div class="alert-symbol">✓</div><div><h4>${t("alertNoneRemote")}</h4><p>${t("alertNoneRemoteDetail")}</p></div></article>`
      : `<article class="alert-empty glass-panel"><div class="alert-symbol">i</div><div><h4>${t("noAccounts")}</h4><p>${t("alertConnectDetail")}</p></div></article>`;
}

function formatRuleDuration(minutes) {
  const value = Number(minutes || 0);
  if (value >= 10080 && value % 10080 === 0) return t("weeks", { count:value / 10080 });
  if (value >= 1440 && value % 1440 === 0) return t("days", { count:value / 1440 });
  if (value >= 60 && value % 60 === 0) return t("hours", { count:value / 60 });
  return t("minutes", { count:value });
}

function openAccountAlertsDialog(account) {
  if (!account || account.provider === "mimo") return;
  const settings = account.alertSettings || {};
  state.alertAccountId = account.id;
  els.accountAlertsTitle.textContent = t("alertRulesTitle", { name:accountDisplayName(account) });
  els.accountAlertsSummary.textContent = t("alertRulesSummary", { balance:state.backend.settings?.lowBalanceThreshold ?? 10, quota:state.backend.settings?.usageThreshold ?? 80 });
  els.accountAlertsEnabled.checked = settings.enabled !== false;
  els.accountLowBalanceThreshold.value = settings.lowBalanceThreshold ?? "";
  els.accountUsageThreshold.value = settings.usageThreshold ?? "";
  setComboboxValue(els.accountStaleAfterMinutes, settings.staleAfterMinutes ?? "", false);
  els.accountBalanceRule.hidden = account.provider !== "deepseek";
  els.accountUsageRule.hidden = account.provider === "deepseek";
  updateAccountAlertFieldState();
  els.accountAlertsDialog.showModal();
}

function renderAccountHealth(accounts) {
  const freshness = overallFreshness(accounts);
  const healthy = accounts.filter(account => account.enabled !== false && ["fresh", "aging"].includes(accountFreshness(account).level)).length;
  const attention = accounts.filter(account => account.enabled !== false && ["error", "stale", "never"].includes(accountFreshness(account).level)).length;
  els.healthMonitored.textContent = freshness.monitored;
  els.healthHealthy.textContent = healthy;
  els.healthAttention.textContent = attention;
  els.healthPaused.textContent = freshness.counts.paused;
  els.retryFailedButton.disabled = !accounts.some(account => account.enabled !== false && account.lastError);
}

function renderSyncCenter(accounts) {
  const sync = state.backend.sync || {};
  const activeIds = new Set(sync.activeAccountIds || []);
  const activeCount = activeIds.size;
  els.syncCenterBadge.className = `sync-center-badge${activeCount ? " active" : ""}`;
  els.syncCenterBadge.textContent = activeCount ? t("syncActiveTasks", { count: activeCount }) : t("syncIdle");
  els.syncCenterSummary.innerHTML = [
    [t("syncMonitored"), String(sync.monitoredCount ?? accounts.filter(account => account.enabled !== false).length)],
    [t("syncFailures"), String(sync.failedCount ?? accounts.filter(account => account.lastError).length)],
    [t("syncLatestAttempt"), relativeSyncTime(sync.lastAttemptAt)],
    [t("syncLatestSuccess"), relativeSyncTime(sync.lastSuccessAt)]
  ].map(([label,value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  els.syncQueueList.innerHTML = accounts.length ? accounts.map(account => {
    const active = activeIds.has(account.id);
    const freshness = accountFreshness(account);
    const retryLabel = Number(state.backend.settings?.autoSyncMinutes || 0) > 0 ? relativeFutureTime(account.nextRetryAt) : "";
    const status = active ? t("syncReadingRemote") : account.enabled === false ? t("healthPaused") : retryLabel ? retryLabel : account.lastError ? t("syncWaitingNext") : account.lastSync ? t("syncWaitingNext") : t("syncWaitingFirst");
    const detail = active ? t("syncBrowseExisting") : account.lastError && retryLabel ? t("syncConsecutiveFailure", { count: account.consecutiveFailures || 1, time: relativeSyncTime(account.lastAttemptAt) }) : account.lastAttemptAt ? t("syncRecentAttempt", { time: relativeSyncTime(account.lastAttemptAt) }) : t("syncNoRemoteRequest");
    return `<div class="sync-queue-row ${active ? "active" : ""}">${platformLogo(account.provider, "sync-provider-logo")}<div><b>${escapeHtml(accountDisplayName(account))}</b><span>${escapeHtml(providers[account.provider]?.name || account.provider)} · ${escapeHtml(detail)}</span></div><span class="sync-queue-status ${active ? "active" : freshness.level}"><i></i>${escapeHtml(status)}</span></div>`;
  }).join("") : `<div class="sync-center-empty">${t("syncQueueEmpty")}</div>`;
}

function renderCapabilityMatrix() {
  const matrix = state.backend.capabilities?.matrix || [];
  els.capabilityMatrix.innerHTML = matrix.length ? matrix.map(platform => {
    const observed = new Set(platform.observedProductIds || []);
    const items = (platform.items || []).map(item => {
      const isObserved = observed.has(item.id) || (platform.provider === "deepseek" && item.id === "balance" && platform.connected);
      const statusClass = item.support === "unavailable" || item.support === "console_only" || item.support === "disabled" ? "limited" : isObserved ? "available" : "supported";
      const statusText = item.support === "disabled" ? t("capabilityUnavailable") : item.support === "unavailable" ? t("capabilityNoEndpoint") : item.support === "console_only" ? t("capabilityConsoleOnly") : isObserved ? t("capabilityRead") : platform.connected ? t("capabilityWaiting") : t("capabilityCanConnect");
      return `<div class="capability-item"><span><b>${escapeHtml(i18nField(item.label, item.labelKey))}</b><small>${escapeHtml(i18nField(item.source, item.sourceKey))}</small></span><em class="${statusClass}">${statusText}</em></div>`;
    }).join("");
    return `<section class="capability-provider"><header>${platformLogo(platform.provider, "capability-provider-logo")}<div><b>${escapeHtml(i18nField(platform.label, platform.labelKey))}</b><span>${platform.connected ? t("capabilityAccountsConnected", { count: platform.accountCount }) : t("capabilityNoAccount")}</span></div></header>${items}</section>`;
  }).join("") : `<div class="sync-center-empty">${t("capabilityLoading")}</div>`;
}

function renderSyncHistory(accounts) {
  const events = state.backend.syncEvents || [];
  const successCount = events.filter(event => event.success).length;
  const failedCount = events.length - successCount;
  const averageDuration = events.length ? Math.round(events.reduce((sum,event) => sum + Number(event.durationMs || 0), 0) / events.length) : 0;
  els.syncEventSummary.innerHTML = [
    [t("historyAllTasks"), String(events.length), t("historyLocalSyncMetadata")],
    [t("historySyncSuccess"), String(successCount), events.length ? t("historySuccessRate", { count: Math.round(successCount / events.length * 100) }) : t("historyNoRecords")],
    [t("historySyncFailed"), String(failedCount), failedCount ? t("historyRetryAccount") : t("historyNoFailures")],
    [t("historyAverageDuration"), formatDuration(averageDuration), t("historyRecent120")]
  ].map(([label,value,note]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join("");
  document.querySelectorAll("[data-sync-history-filter]").forEach(button => {
    const active = button.dataset.syncHistoryFilter === state.syncEventFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const visible = events.filter(event => state.syncEventFilter === "all" || (state.syncEventFilter === "success" ? event.success : !event.success));
  els.syncEventCount.textContent = t("historyRecordCount", { count: visible.length });
  els.syncEventList.innerHTML = visible.length ? visible.slice(0, 40).map(event => {
    const account = accounts.find(item => item.id === event.accountId);
    const logo = account ? platformLogo(account.provider, "sync-provider-logo") : '<span class="sync-event-fallback">?</span>';
    return `<article class="sync-event-row ${event.success ? "success" : "failed"}">
      ${logo}<div class="sync-event-main"><b>${escapeHtml(account ? accountDisplayName(account) : t("historyRemovedAccount"))}</b><span>${escapeHtml(account ? providers[account.provider]?.name || account.provider : t("historyArchivedAccount"))} · ${escapeHtml(formatDate(event.timestamp))}</span></div>
      <div class="sync-event-metrics"><span>${formatDuration(event.durationMs)}</span><span>${t("historyRemoteItems", { count: event.productCount || 0 })}</span></div>
      <div class="sync-event-result"><strong>${event.success ? t("historySyncSuccess") : t("historySyncFailed")}</strong><small>${escapeHtml(localizeSyncEventMessage(event))}</small></div>
      ${!event.success && account ? `<button class="mini-button" data-sync-account="${escapeHtml(account.id)}"><span>${t("historyRetry")}</span></button>` : ""}
    </article>`;
  }).join("") : `<div class="sync-history-empty">${events.length ? t("historyNoCategory") : t("historyAfterSync")}</div>`;
}

function renderAccounts() {
  const accounts = state.backend.accounts || [];
  const history = state.backend.history || [];
  renderAccountHealth(accounts);
  renderSyncCenter(accounts);
  renderCapabilityMatrix();
  renderSyncHistory(accounts);
  els.accountListTitle.textContent = t("accountsListTitle", { count: accounts.length });
  els.accountsEmpty.hidden = accounts.length > 0;
  els.accountsList.innerHTML = accounts.map(account => {
    const provider = providers[account.provider];
    const balance = account.balances?.find(item => item.currency === "CNY") || account.balances?.[0];
    const primaryProduct = account.products?.[0];
    const metricLabel = balance ? t("accountsCurrentBalance") : t("accountsPrimaryMetric");
    const metricValue = balance ? `${moneySymbol(balance.currency)} ${balance.total}` : primaryProduct?.usage || "—";
    const syncing = (state.backend.sync?.activeAccountIds || []).includes(account.id);
    const availability = syncing ? t("accountsSyncing") : account.enabled === false ? t("accountsMonitoringPaused") : account.isAvailable ? ((account.provider === "volcengine" || account.provider === "openai" || account.provider === "mimo") ? t("accountsProductCount", { count: account.products?.length || 0 }) : t("accountsAvailable")) : t("accountsSyncError");
    const freshness = syncing ? { level:"syncing", label:t("accountsSyncing") } : accountFreshness(account);
    const accountId = escapeHtml(account.id);
    return `<article class="saved-account directory-account ${account.id === state.accountId ? 'selected' : ''} ${account.enabled === false ? 'paused-account' : ''}" data-sort-account="${accountId}">
      <div class="saved-account-head">
        ${platformLogo(account.provider, "account-brand-logo")}
        <div><b>${escapeHtml(accountDisplayName(account))}</b><span>${escapeHtml(provider?.name || account.provider)} · ${escapeHtml(account.keyHint)}</span></div>
        <span class="freshness-badge ${freshness.level}"><i></i>${escapeHtml(freshness.label)}</span>
        <i class="drag-handle account-drag-handle" data-drag-account="${accountId}" title="${t("dragAccountOrder")}" aria-label="${t("dragAccountOrder")}">⋮⋮</i>
      </div>
      <div class="account-directory-metrics"><div><span>${t("accountsConnectionStatus")}</span><strong>${escapeHtml(availability)}</strong></div><div><span>${metricLabel}</span><strong>${escapeHtml(metricValue)}</strong></div><div><span>${t("accountsLatestSync")}</span><strong>${escapeHtml(relativeSyncTime(account.lastSync))}</strong><small>${escapeHtml(formatDate(account.lastSync))} · ${t("accountsRemoteDuration", { duration: formatDuration(account.lastSyncDurationMs) })}</small></div></div>
      ${account.lastError ? `<p class="account-error">${escapeHtml(account.lastErrorCode ? errorMessage({ errorCode: account.lastErrorCode }, localizeRemoteCopy(account.lastError)) : localizeRemoteCopy(account.lastError))}</p>` : ""}
      ${(account.productErrors || []).length ? `<p class="account-error">${localizeBackendErrors(account.productErrors, account.productErrorCodes).map(escapeHtml).join("<br>")}</p>` : ""}
      <div class="account-actions"><button class="soft-button compact" data-view-account="${accountId}" data-account-provider="${escapeHtml(account.provider)}">${t("viewAccountData")}</button><span><button class="mini-button" data-diagnose-account="${accountId}">${t("diagnosticConnection")}</button>${account.provider === "mimo" ? "" : `<button class="mini-button" data-account-alerts="${accountId}">${account.alertSettings?.enabled === false ? t("accountsAlertsOff") : t("accountRules")}</button>`}${account.provider === "openai" ? "" : `<button class="mini-button" data-edit-connection="${accountId}" ${syncing ? "disabled" : ""}>${t("connectionTitle")}</button>`}<button class="mini-button" data-rename-account="${accountId}">${t("renameTitle")}</button><button class="mini-button" data-toggle-account="${accountId}">${account.enabled === false ? t("accountsResumeMonitoring") : t("accountsPauseMonitoring")}</button><button class="mini-button" data-sync-account="${accountId}" ${syncing ? "disabled" : ""}><span>${syncing ? t("accountsSyncInProgress") : t("actionSyncNow")}</span></button><button class="danger-link" data-delete-account="${accountId}" ${syncing ? "disabled" : ""}>${t("dialogRemove")}</button></span></div>
    </article>`;
  }).join("");

  els.historyCount.textContent = t("historyRecordCount", { count: history.length });
  els.historyList.innerHTML = history.length ? history.slice(0, 24).map(item => {
    const account = accounts.find(candidate => candidate.id === item.accountId);
    return `<div class="history-row"><i></i><div><b>${escapeHtml(account ? accountDisplayName(account) : t("historyRemovedAccount"))}</b><span>${escapeHtml(formatDate(item.timestamp))}</span></div><strong>${escapeHtml(`${moneySymbol(item.currency)} ${item.total}`)}</strong><small>${escapeHtml(item.currency)}</small></div>`;
  }).join("") : `<div class="history-empty">${t("accountsBalanceHistoryEmpty")}</div>`;
}

function updateAccountAlertFieldState() {
  const disabled = !els.accountAlertsEnabled.checked;
  els.accountAlertFields.classList.toggle("disabled-fields", disabled);
  [els.accountLowBalanceThreshold, els.accountUsageThreshold].forEach(input => { input.disabled = disabled; });
  const trigger = els.accountStaleAfterMinutes.closest("[data-combobox]")?.querySelector("[data-combo-trigger]");
  if (trigger) trigger.disabled = disabled;
}

function switchView(view, providerId, accountId) {
  if (providerId) {
    state.provider = providerId;
    state.accountId = accountId || null;
    state.view = "platforms";
    renderNavigation();
  }
  else state.view = view;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `${state.view}View`));
  document.querySelectorAll(".nav-item").forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const headings = {
    overview:[t("overviewEyebrow"),t("overviewTitle")], platforms:[t("platformsEyebrow"),t("platformsTitle")],
    models:[t("modelsEyebrow"),t("modelsTitle")], alerts:[t("alertsEyebrow"),t("alertsTitle")],
    accounts:[t("accountsEyebrow"),t("accountsTitle")],
    settings:[translateStatic("设置"),t("settingsTitle")]
  }[state.view];
  els.eyebrow.textContent = headings[0]; els.pageTitle.textContent = headings[1];
  if (state.view === "platforms") renderPlatform();
  if (state.view === "models") renderComparisons();
  if (state.view === "alerts") renderAlerts();
  if (state.view === "accounts") renderAccounts();
  if (state.view === "settings") populateSettings();
}

function diagnosticPayload(account) {
  const freshness = accountFreshness(account);
  return {
    appVersion: state.backend.version || t("diagnosticUnknownVersion"),
    generatedAt: new Date().toISOString(),
    account: accountDisplayName(account),
    platform: providers[account.provider]?.name || account.provider,
    accountHint: account.keyHint || "—",
    monitoring: account.enabled === false ? "paused" : "active",
    status: freshness.label,
    createdAt: account.createdAt || null,
    lastAttemptAt: account.lastAttemptAt || null,
    lastSuccessAt: account.lastSync || null,
    durationMs: Number(account.lastSyncDurationMs || 0),
    consecutiveFailures: Number(account.consecutiveFailures || 0),
    nextRetryAt: Number(state.backend.settings?.autoSyncMinutes || 0) > 0 ? account.nextRetryAt || null : null,
    products: (account.products || []).map(product => ({ id:product.id, name:product.name, status:product.status || null })),
    productWarnings: account.productErrors || [],
    error: account.lastError || null
  };
}

function showAccountDiagnostics(account) {
  if (!account) return;
  state.diagnosticAccountId = account.id;
  const freshness = accountFreshness(account);
  els.diagnosticTitle.textContent = accountDisplayName(account);
  els.diagnosticSubtitle.textContent = `${providers[account.provider]?.name || account.provider} · ${account.keyHint || t("diagnosticConnectedAccount")}`;
  els.diagnosticBadge.className = `freshness-badge ${freshness.level}`;
  els.diagnosticBadge.querySelector("b").textContent = freshness.label;
  const metrics = [
    [t("diagnosticMonitoring"), account.enabled === false ? t("healthPaused") : t("diagnosticMonitoringActive"), account.enabled === false ? t("diagnosticExcludedSync") : t("diagnosticIncludedSync")],
    [t("diagnosticLastAttempt"), relativeSyncTime(account.lastAttemptAt), formatDate(account.lastAttemptAt)],
    [t("diagnosticLastSuccess"), relativeSyncTime(account.lastSync), formatDate(account.lastSync)],
    [t("diagnosticRemoteDuration"), formatDuration(account.lastSyncDurationMs), t("diagnosticLastRequest")],
    [t("diagnosticConsecutiveFailures"), String(account.consecutiveFailures || 0), Number(state.backend.settings?.autoSyncMinutes || 0) > 0 && account.nextRetryAt ? relativeFutureTime(account.nextRetryAt) : Number(account.consecutiveFailures || 0) ? t("diagnosticCheckCredentials") : t("diagnosticStable")],
    [t("diagnosticProductsFound"), String((account.products || []).length), (account.productErrors || []).length ? t("diagnosticProductWarnings", { count: account.productErrors.length }) : t("diagnosticNoProductWarnings")]
  ];
  els.diagnosticMetrics.innerHTML = metrics.map(item => `<div><span>${escapeHtml(item[0])}</span><strong>${escapeHtml(item[1])}</strong><small>${escapeHtml(item[2])}</small></div>`).join("");
  const errors = [account.lastError, ...(account.productErrors || [])].filter(Boolean);
  els.diagnosticError.hidden = !errors.length;
  els.diagnosticError.innerHTML = errors.length ? `<b>${t("diagnosticRemoteResponse")}</b><p>${errors.map(escapeHtml).join("<br>")}</p>` : "";
  els.diagnosticDialog.showModal();
}

function showRowDialog(index) {
  const provider = providers[state.provider];
  const product = provider.products[state.products[state.provider]];
  const row = product.rows[index];
  els.dialogTitle.textContent = row.name;
  els.dialogDescription.textContent = t("metricDialogDescription", { provider: provider.name, product: product.name, type: row.type });
  els.dialogMetrics.innerHTML = product.columns.map((label,i)=>`<div><span>${escapeHtml(localizeRemoteCopy(label))}</span><strong>${escapeHtml(row.metrics[i]?.[0] || "—")}</strong><small>${escapeHtml(localizeRemoteCopy(row.metrics[i]?.[1] || t("remote")))}</small></div>`).join("");
  els.metricDialog.showModal();
}

let toastTimer;
function showToast(text, requestedTone = "auto") {
  const message = localizeRemoteCopy(String(text || t("operationIncomplete")));
  const tone = requestedTone !== "auto" ? requestedTone
    : /同步完成.*失败|仍失败|已暂停|需要重试/.test(message) ? "warning"
    : /失败|错误|异常|无法|无效|拒绝|过期/.test(message) ? "error"
    : /尚未|暂无|当前没有|未添加|不支持|未提供/.test(message) ? "info"
    : "success";
  const icon = { success:"✓", info:"i", warning:"!", error:"×" }[tone];
  clearTimeout(toastTimer);
  els.toast.classList.remove("success", "info", "warning", "error", "show");
  els.toast.classList.add(tone);
  els.toast.querySelector(".toast-icon").textContent = icon;
  els.toast.querySelector("p").textContent = message;
  requestAnimationFrame(()=>els.toast.classList.add("show"));
  toastTimer = setTimeout(()=>els.toast.classList.remove("show"), 2400);
}

function setUpdateStatus(text, tone = "") {
  els.updateStatusText.textContent = localizeRemoteCopy(text);
  els.updateStatusText.className = tone ? `update-status-${tone}` : "";
}

function renderUpdateNotes(notes) {
  const source = String(notes || "").trim();
  if (!source) return `<p>${t("updateNoNotes")}</p>`;
  let inList = false;
  const output = [];
  const closeList = () => {
    if (inList) { output.push("</ul>"); inList = false; }
  };
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { closeList(); continue; }
    if (line === "---") { closeList(); output.push("<hr>"); continue; }
    if (line.startsWith("### ")) { closeList(); output.push(`<h4>${escapeHtml(line.slice(4))}</h4>`); continue; }
    if (line.startsWith("## ")) { closeList(); output.push(`<h3>${escapeHtml(line.slice(3))}</h3>`); continue; }
    if (line.startsWith("- ")) {
      if (!inList) { output.push("<ul>"); inList = true; }
      output.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    output.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return output.join("");
}

function showUpdateDialog(update) {
  state.availableUpdate = update;
  els.updateDialogTitle.textContent = t("updateAvailableTitle", { version: update.version });
  els.updateDialogSummary.textContent = t("updateAvailableSummary", { currentVersion: update.currentVersion });
  els.updateReleaseNotes.innerHTML = renderUpdateNotes(update.notes);
  els.updateProgress.hidden = true;
  els.updateProgressBar.style.width = "0%";
  els.updateProgressText.textContent = t("updatePreparingDownload");
  [els.updateDialogClose, els.skipUpdateButton, els.laterUpdateButton, els.installUpdateButton].forEach(button => button.disabled = false);
  els.installUpdateButton.querySelector("span").textContent = t("updateDownloadInstall");
  if (!els.updateDialog.open) els.updateDialog.showModal();
}

async function checkForUpdates({manual = false} = {}) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
  if (manual) showToast(t("updateInstalledOnly"), "info");
    return;
  }
  const button = els.checkUpdateButton;
  button.disabled = true;
  button.classList.add("checking");
  button.querySelector("span").textContent = t("updateChecking");
  setUpdateStatus(t("updateConnectingRelease"));
  try {
    const update = await invoke("check_for_update");
    if (!update) {
      state.availableUpdate = null;
    setUpdateStatus(t("updateLatest"), "success");
    if (manual) showToast(t("updateLatest"));
      return;
    }
    setUpdateStatus(t("updateFound", { version: update.version }), "available");
    const skipped = state.backend.settings?.skippedUpdateVersion === update.version;
    if (manual || !skipped) showUpdateDialog(update);
  } catch (error) {
    const message = String(error || t("updateCheckError"));
    setUpdateStatus(t("updateCheckFailed"), "error");
    if (manual) showToast(message, "error");
    else console.warn("自动检查更新失败", message);
  } finally {
    button.disabled = false;
    button.classList.remove("checking");
    button.querySelector("span").textContent = t("updateCheck");
  }
}

function maybeCheckForUpdates() {
  if (state.updateCheckStarted || !state.backend.settings) return;
  state.updateCheckStarted = true;
  if ((state.backend.settings.updateCheckMode || "startup") === "startup") {
    window.setTimeout(() => checkForUpdates(), 1600);
  }
}

async function installAvailableUpdate() {
  const invoke = window.__TAURI__?.core?.invoke;
  const Channel = window.__TAURI__?.core?.Channel;
  if (!invoke || !Channel) { showToast(t("updateEnvironmentInstall"), "error"); return; }
  let downloaded = 0;
  let contentLength = 0;
  const channel = new Channel();
  channel.onmessage = message => {
    const event = String(message?.event || "").toLowerCase();
    const data = message?.data || {};
    if (event === "started") {
      contentLength = Number(data.contentLength ?? data.content_length ?? 0);
  els.updateProgressText.textContent = contentLength ? t("updateStartingDownload") : t("updateDownloading");
    } else if (event === "progress") {
      downloaded += Number(data.chunkLength ?? data.chunk_length ?? 0);
      if (contentLength > 0) {
        const percent = Math.min(100, Math.round(downloaded / contentLength * 100));
        els.updateProgressBar.style.width = `${percent}%`;
      els.updateProgressText.textContent = t("updateDownloaded", { percent });
      }
    } else if (event === "finished") {
      els.updateProgressBar.style.width = "100%";
    els.updateProgressText.textContent = t("updateVerifyingInstall");
    }
  };
  [els.updateDialogClose, els.skipUpdateButton, els.laterUpdateButton, els.installUpdateButton].forEach(button => button.disabled = true);
  els.updateProgress.hidden = false;
    els.installUpdateButton.querySelector("span").textContent = t("updateInstalling");
  try {
    await invoke("install_update", { onEvent: channel });
  } catch (error) {
    setUpdateStatus(t("updateInstallFailed"), "error");
    showToast(String(error || t("updateInstallError")), "error");
    [els.updateDialogClose, els.skipUpdateButton, els.laterUpdateButton, els.installUpdateButton].forEach(button => button.disabled = false);
    els.installUpdateButton.querySelector("span").textContent = t("updateRetryCheck");
    state.availableUpdate = null;
  }
}

let dragState = null;
let suppressClickUntil = 0;

function renderOrderedAccountSurfaces() {
  renderNavigation();
  renderOverview();
  renderAccounts();
  if (state.view === "models") renderComparisons();
}

function orderedProviderIds(accounts = state.backend.accounts || []) {
  const available = [...new Set(accounts.map(account => account.provider))];
  return [...new Set([...(state.backend.providerOrder || []), ...available])].filter(provider => available.includes(provider));
}

const sortableSurfaces = [
  ["#platformNav [data-sort-account]", "sortAccount"],
  ["#platformCards [data-sort-provider]", "sortProvider"],
  ["#accountsList [data-sort-account]", "sortAccount"]
];

function captureSortableLayout() {
  return sortableSurfaces.map(([selector, key]) => ({
    selector,
    key,
    rects:new Map([...document.querySelectorAll(selector)].map(element => [element.dataset[key], element.getBoundingClientRect()]))
  }));
}

function animateSortableLayout(layout) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  layout.forEach(({selector, key, rects}) => {
    document.querySelectorAll(selector).forEach(element => {
      const before = rects.get(element.dataset[key]);
      const after = element.getBoundingClientRect();
      if (!before) return;
      const x = before.left - after.left;
      const y = before.top - after.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
      element.animate([
        { transform:`translate3d(${x}px, ${y}px, 0)` },
        { transform:"translate3d(0, 0, 0)" }
      ], { duration:360, easing:"cubic-bezier(.22,.8,.22,1)" });
    });
  });
}

function updateOrderedAccountSurfaces(accounts) {
  const layout = captureSortableLayout();
  state.backend.accounts = accounts;
  renderOrderedAccountSurfaces();
  animateSortableLayout(layout);
}

function updateProviderOrder(providerOrder) {
  const layout = captureSortableLayout();
  state.backend.providerOrder = providerOrder;
  renderOverview();
  animateSortableLayout(layout);
}

async function persistAccountOrder(nextAccounts, successText = t("orderSaved")) {
  const previousAccounts = [...(state.backend.accounts || [])];
  updateOrderedAccountSurfaces(nextAccounts);
  try {
    await apiRequest("/api/accounts/reorder", {
      method:"POST",
      body:JSON.stringify({accountIds:nextAccounts.map(account => account.id)})
    });
    showToast(successText);
  } catch (error) {
    updateOrderedAccountSurfaces(previousAccounts);
    showToast(errorMessage(error), "error");
  }
}

function moveAccount(sourceId, targetId, insertAfter) {
  const accounts = [...(state.backend.accounts || [])];
  const sourceIndex = accounts.findIndex(account => account.id === sourceId);
  const targetIndex = accounts.findIndex(account => account.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const [source] = accounts.splice(sourceIndex, 1);
  let insertion = accounts.findIndex(account => account.id === targetId);
  if (insertAfter) insertion += 1;
  accounts.splice(insertion, 0, source);
  persistAccountOrder(accounts, t("accountOrderSaved"));
}

function moveProvider(sourceProvider, targetProvider, insertAfter) {
  const providersInOrder = orderedProviderIds();
  const sourceIndex = providersInOrder.indexOf(sourceProvider);
  const targetIndex = providersInOrder.indexOf(targetProvider);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  providersInOrder.splice(sourceIndex, 1);
  let insertion = providersInOrder.indexOf(targetProvider);
  if (insertAfter) insertion += 1;
  providersInOrder.splice(insertion, 0, sourceProvider);
  persistProviderOrder(providersInOrder);
}

async function persistProviderOrder(providerOrder) {
  const previousOrder = orderedProviderIds();
  updateProviderOrder(providerOrder);
  try {
    const result = await apiRequest("/api/providers/reorder", {
      method:"POST",
      body:JSON.stringify({providerIds:providerOrder})
    });
    state.backend.providerOrder = result.providerOrder || providerOrder;
  showToast(t("platformOrderSaved"));
  } catch (error) {
    updateProviderOrder(previousOrder);
    showToast(errorMessage(error), "error");
  }
}

function clearDragTargets() {
  document.querySelectorAll(".drag-over,.drag-before,.drag-after").forEach(element => element.classList.remove("drag-over", "drag-before", "drag-after"));
}

function clearPointerSort() {
  if (!dragState) return;
  dragState.source?.classList.remove("sorting-source");
  dragState.ghost?.remove();
  clearDragTargets();
  document.body.classList.remove("pointer-sorting");
  dragState = null;
}

document.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  const accountHandle = event.target.closest("[data-drag-account]");
  const providerHandle = event.target.closest("[data-drag-provider]");
  const handle = accountHandle || providerHandle;
  if (!handle) return;
  const kind = accountHandle ? "account" : "provider";
  const source = handle.closest(kind === "account" ? "[data-sort-account]" : "[data-sort-provider]");
  if (!source) return;
  dragState = {
    kind,
    id:accountHandle ? accountHandle.dataset.dragAccount : providerHandle.dataset.dragProvider,
    pointerId:event.pointerId,
    startX:event.clientX,
    startY:event.clientY,
    moved:false,
    source,
    target:null,
    insertAfter:false
  };
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
});

document.addEventListener("pointermove", event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (!dragState.moved && Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) < 5) return;
  if (!dragState.moved) {
    dragState.moved = true;
    const rect = dragState.source.getBoundingClientRect();
    const ghost = dragState.source.cloneNode(true);
    ghost.classList.remove("sorting-source", "drag-over", "drag-before", "drag-after");
    ghost.classList.add("sort-drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    dragState.ghost = ghost;
    document.body.appendChild(ghost);
    dragState.source.classList.add("sorting-source");
    document.body.classList.add("pointer-sorting");
  }
  dragState.ghost.style.transform = `translate3d(${event.clientX - dragState.offsetX}px, ${event.clientY - dragState.offsetY}px, 0) rotate(.35deg)`;
  const selector = dragState.kind === "account" ? "[data-sort-account]" : "[data-sort-provider]";
  const dataKey = dragState.kind === "account" ? "sortAccount" : "sortProvider";
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(selector);
  clearDragTargets();
  dragState.target = null;
  if (target && target.dataset[dataKey] !== dragState.id) {
    const rect = target.getBoundingClientRect();
    dragState.target = target;
    dragState.insertAfter = dragState.kind === "provider"
      ? event.clientY > rect.top + rect.height / 2 || (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && event.clientX > rect.left + rect.width / 2)
      : event.clientY > rect.top + rect.height / 2;
    target.classList.add("drag-over", dragState.insertAfter ? "drag-after" : "drag-before");
  }
  event.preventDefault();
});

document.addEventListener("pointerup", event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const {kind, id, moved, target, insertAfter} = dragState;
  const targetId = target?.dataset[kind === "account" ? "sortAccount" : "sortProvider"];
  clearPointerSort();
  if (moved) suppressClickUntil = Date.now() + 300;
  if (!moved || !targetId) return;
  if (kind === "account") moveAccount(id, targetId, insertAfter);
  else moveProvider(id, targetId, insertAfter);
});

document.addEventListener("pointercancel", clearPointerSort);

function startSyncPolling() {
  state.syncPollUsers += 1;
  if (state.syncPollTimer) return;
  state.syncPollTimer = setInterval(() => loadBackendState({quiet:true}), SYNC_POLL_INTERVAL_MS);
}

function stopSyncPolling() {
  state.syncPollUsers = Math.max(0, state.syncPollUsers - 1);
  if (state.syncPollUsers || !state.syncPollTimer) return;
  clearInterval(state.syncPollTimer);
  state.syncPollTimer = null;
}

document.addEventListener("click", async e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const mimoEndpoint = e.target.closest("[data-mimo-base-url]");
  if (mimoEndpoint) {
    const targetId = mimoEndpoint.dataset.mimoTarget || "mimoBaseUrl";
    els[targetId].value = mimoEndpoint.dataset.mimoBaseUrl;
    syncMimoEndpointPresets(targetId);
  }
  const comboOption = e.target.closest(".combo-option[data-value]");
  const comboTrigger = e.target.closest("[data-combo-trigger]");
  if (comboOption && !comboOption.disabled) {
    const combo = comboOption.closest("[data-combobox]");
    setComboboxValue(combo.querySelector("input[type=hidden]"), comboOption.dataset.value);
    closeComboboxes();
  } else if (comboTrigger) {
    const combo = comboTrigger.closest("[data-combobox]");
    const willOpen = !combo.classList.contains("open");
    closeComboboxes(combo);
    combo.classList.toggle("open", willOpen);
    comboTrigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) positionComboboxMenu(combo);
  } else if (!e.target.closest("[data-combobox]")) {
    closeComboboxes();
  }
  const nav = e.target.closest("[data-view]"); if (nav) switchView(nav.dataset.view);
  const target = e.target.closest("[data-target-view]"); if (target) switchView(target.dataset.targetView);
  const alertFilter = e.target.closest("[data-alert-filter]");
  if (alertFilter) { state.alertFilter = alertFilter.dataset.alertFilter; renderAlerts(); }
  const snoozeAlert = e.target.closest("[data-snooze-alert], [data-resume-alert]");
  if (snoozeAlert) {
    const resume = snoozeAlert.hasAttribute("data-resume-alert");
    const alertKey = snoozeAlert.getAttribute(resume ? "data-resume-alert" : "data-snooze-alert");
    snoozeAlert.disabled = true;
    try {
      await apiRequest("/api/alerts/snooze", { method:resume ? "DELETE" : "POST", body:JSON.stringify({alertKey}) });
      await loadBackendState({quiet:true});
      showToast(resume ? t("alertNotificationsResumed") : t("alertSnoozed"));
    } catch (error) { showToast(errorMessage(error), "error"); }
    finally { snoozeAlert.disabled = false; }
  }
  const syncHistoryFilter = e.target.closest("[data-sync-history-filter]");
  if (syncHistoryFilter) { state.syncEventFilter = syncHistoryFilter.dataset.syncHistoryFilter; renderSyncHistory(state.backend.accounts || []); }
  const accountNav = e.target.closest("[data-account]");
  if (accountNav) switchView("platforms", accountNav.dataset.accountProvider, accountNav.dataset.account);
  const viewAccount = e.target.closest("[data-view-account]");
  if (viewAccount) switchView("platforms", viewAccount.dataset.accountProvider, viewAccount.dataset.viewAccount);
  const provider = e.target.closest("[data-provider]"); if (provider) switchView("platforms", provider.dataset.provider);
  const openAccountDialog = e.target.closest("[data-open-account-dialog]"); if (openAccountDialog) els.accountDialog.showModal();
  const openSettings = e.target.closest("[data-open-settings]"); if (openSettings) switchView("settings");
  const product = e.target.closest("[data-product]"); if (product) { state.products[state.provider] = product.dataset.product; renderPlatform(); }
  const trendRange = e.target.closest("[data-trend-range]");
  if (trendRange) { state.metricRangeDays = Number(trendRange.dataset.trendRange); renderPlatform(); }
  const trendMetric = e.target.closest("[data-trend-metric]");
  if (trendMetric) {
    const account = getSelectedAccount(state.provider);
    if (account) state.metricSelections[`${account.id}|${state.products[state.provider]}`] = trendMetric.dataset.trendMetric;
    renderMetricTrend(account, state.products[state.provider]);
  }
  const row = e.target.closest("[data-row]"); if (row) showRowDialog(Number(row.dataset.row));
  const toggle = e.target.closest(".toggle"); if (toggle) toggle.classList.toggle("off");
  const diagnoseAccount = e.target.closest("[data-diagnose-account]");
  if (diagnoseAccount) {
    showAccountDiagnostics((state.backend.accounts || []).find(item => item.id === diagnoseAccount.dataset.diagnoseAccount));
  }
  const editConnection = e.target.closest("[data-edit-connection]");
  if (editConnection) {
    openConnectionDialog((state.backend.accounts || []).find(item => item.id === editConnection.dataset.editConnection));
  }
  const accountAlerts = e.target.closest("[data-account-alerts]");
  if (accountAlerts) {
    const account = (state.backend.accounts || []).find(item => item.id === accountAlerts.dataset.accountAlerts);
    openAccountAlertsDialog(account);
  }
  const renameAccount = e.target.closest("[data-rename-account]");
  if (renameAccount) {
    const account = (state.backend.accounts || []).find(item => item.id === renameAccount.dataset.renameAccount);
    state.renameAccountId = account?.id || null;
    els.renameAccountName.value = account?.name || "";
    els.renameAccountDialog.showModal();
    setTimeout(() => { els.renameAccountName.focus(); els.renameAccountName.select(); }, 30);
  }
  const toggleAccount = e.target.closest("[data-toggle-account]");
  if (toggleAccount) {
    const account = (state.backend.accounts || []).find(item => item.id === toggleAccount.dataset.toggleAccount);
    const nextEnabled = account?.enabled === false;
    try {
      await apiRequest(`/api/accounts/${toggleAccount.dataset.toggleAccount}`, { method:"PATCH", body:JSON.stringify({enabled:nextEnabled}) });
      await loadBackendState({quiet:true});
      showToast(nextEnabled ? t("accountMonitoringResumed") : t("accountMonitoringPausedNotice"));
    } catch (error) { showToast(errorMessage(error)); }
  }
  const syncAccount = e.target.closest("[data-sync-account]");
  if (syncAccount) {
    syncAccount.disabled = true;
    const label = syncAccount.querySelector("span");
  if (label) label.textContent = t("syncingEllipsis");
    startSyncPolling();
    try {
      await apiRequest(`/api/accounts/${syncAccount.dataset.syncAccount}/sync`, { method:"POST" });
      await loadBackendState({quiet:true});
      const synced = state.backend.accounts.find(account => account.id === syncAccount.dataset.syncAccount);
      showToast(synced?.enabled === false ? t("syncSinglePaused") : synced?.provider === "volcengine" ? t("syncArkDone") : synced?.provider === "openai" ? t("syncOpenAiDone") : synced?.provider === "mimo" ? t("syncMimoDone") : synced?.provider === "siliconflow" ? t("syncSiliconFlowDone") : synced?.provider === "bailian" ? t("syncBailianDone") : synced?.provider === "openrouter" ? t("syncOpenRouterDone") : t("syncDeepSeekDone"));
    } catch (error) { await loadBackendState({quiet:true}); showToast(errorMessage(error)); }
  finally { stopSyncPolling(); syncAccount.disabled = false; if (label) label.textContent = t("actionSyncNow"); }
  }
  const deleteAccount = e.target.closest("[data-delete-account]");
  if (deleteAccount) {
    const account = (state.backend.accounts || []).find(item => item.id === deleteAccount.dataset.deleteAccount);
    if (!account) return;
    state.deleteAccountId = account.id;
  els.deleteAccountDialogTitle.textContent = t("removeAccountTitle", { name: accountDisplayName(account) });
  els.deleteAccountDialogSummary.textContent = t("dialogRemoveSummary");
    els.deleteAccountDialog.showModal();
  }
});

document.addEventListener("keydown", event => { if (event.key === "Escape") closeComboboxes(); });
window.addEventListener("resize", () => document.querySelectorAll("[data-combobox].open").forEach(positionComboboxMenu));
document.addEventListener("scroll", (event) => {
    // Scrolling inside an open combo menu must not reposition it: repositioning
    // clears the menu's scrollTop and snaps it back to the first option.
    if (event.target instanceof Element && event.target.closest(".combo-menu")) return;
    document.querySelectorAll("[data-combobox].open").forEach(positionComboboxMenu);
  }, true);
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click",()=>switchView(b.dataset.view)));
els.modelFamilySelect.addEventListener("change", renderComparisons);
els.modelLevelSelect.addEventListener("change", renderComparisons);
els.modelSearchInput.addEventListener("input", renderComparisons);
els.accountProvider.addEventListener("change", updateCredentialFields);
els.interfaceLanguage.addEventListener("change", () => {
  const language = normalizeInterfaceLanguagePreference(els.interfaceLanguage.value);
  state.languagePreferenceDirty = true;
  state.languagePreferenceInitialized = true;
  state.interfaceLanguagePreference = language;
  if (state.backend.settings) state.backend.settings.interfaceLanguage = language;
  applyInterfaceLanguage(language);
  rerenderForInterfaceLanguage();
  queueSettingsSave("immediate");
});
els.appearanceMode.addEventListener("change", () => { applyTheme(els.appearanceMode.value); queueSettingsSave(); });
els.autoSyncMinutes.addEventListener("change", () => queueSettingsSave());
els.staleAfterMinutes.addEventListener("change", () => queueSettingsSave());
els.updateCheckMode.addEventListener("change", () => queueSettingsSave());
els.historyRetentionDays.addEventListener("change", () => queueSettingsSave());
els.mimoBaseUrl.addEventListener("input", syncMimoEndpointPresets);
els.mimoApiKey.addEventListener("input", () => {
  const key = els.mimoApiKey.value.trim();
  const current = els.mimoBaseUrl.value.trim();
  if (key.startsWith("tp-") && current === APP_DEFAULTS.mimoPaygUrl) {
    els.mimoBaseUrl.value = APP_DEFAULTS.mimoTokenPlanUrl;
  } else if (key.startsWith("sk-") && current.includes("token-plan-")) {
    els.mimoBaseUrl.value = APP_DEFAULTS.mimoPaygUrl;
  }
  syncMimoEndpointPresets();
});
els.editMimoBaseUrl.addEventListener("input", () => syncMimoEndpointPresets("editMimoBaseUrl"));
els.editMimoApiKey.addEventListener("input", () => {
  const key = els.editMimoApiKey.value.trim();
  const current = els.editMimoBaseUrl.value.trim();
  if (key.startsWith("tp-") && current === APP_DEFAULTS.mimoPaygUrl) {
    els.editMimoBaseUrl.value = APP_DEFAULTS.mimoTokenPlanUrl;
  } else if (key.startsWith("sk-") && current.includes("token-plan-")) {
    els.editMimoBaseUrl.value = APP_DEFAULTS.mimoPaygUrl;
  }
  syncMimoEndpointPresets("editMimoBaseUrl");
});
els.refreshButton.addEventListener("click", async () => {
  els.refreshButton.classList.add("spinning");
  els.refreshButton.disabled = true;
  els.refreshButton.setAttribute("aria-busy", "true");
  els.refreshButton.title = t("syncRefreshing");
  els.syncText.textContent = t("syncRefreshing");
  startSyncPolling();
  try {
    const result = await apiRequest("/api/sync", { method:"POST" }, true);
    await loadBackendState({quiet:true});
    const results = result.results || [];
    const succeeded = results.filter(item => item.ok).length;
    const failed = results.length - succeeded;
    els.syncText.textContent = failed ? t("syncStatusSummary", { succeeded, failed }) : succeeded ? t("syncAccountsDone", { count: succeeded }) : t("syncNoAccounts");
    showToast(failed ? t("syncFinished", { succeeded, failed }) : succeeded ? t("syncUpdatedAccounts", { count: succeeded }) : t("accountNoReal"), failed ? "warning" : succeeded ? "success" : "info");
  } catch (error) { els.syncText.textContent = t("historySyncFailed"); showToast(errorMessage(error)); }
  finally {
    stopSyncPolling();
    els.refreshButton.classList.remove("spinning");
    els.refreshButton.disabled = false;
    els.refreshButton.removeAttribute("aria-busy");
    els.refreshButton.title = t("overviewRefresh");
  }
});
els.accountForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = els.connectAccountButton;
  const provider = els.accountProvider.value;
  button.disabled = true;
  button.classList.add("loading");
  button.querySelector("span").textContent = provider === "volcengine" ? t("workingDiscover") : provider === "openai" ? t("workingReadCodex") : t("workingVerify");
  try {
    const body = provider === "volcengine"
      ? { provider, name:els.accountName.value, accessKey:els.volcAccessKey.value, secretKey:els.volcSecretKey.value, region:els.volcRegion.value, projectName:els.volcProject.value }
      : provider === "openai"
        ? { provider, name:els.accountName.value }
        : provider === "mimo"
          ? { provider, name:els.accountName.value, apiKey:els.mimoApiKey.value, baseUrl:els.mimoBaseUrl.value }
          : { provider, name:els.accountName.value, apiKey:els.accountKey.value };
    const result = await apiRequest("/api/accounts", { method:"POST", body:JSON.stringify(body) });
    state.accountId = result.account.id;
    state.provider = result.account.provider;
    els.accountForm.reset();
    setComboboxValue(els.accountProvider, "deepseek", false);
    els.volcRegion.value = APP_DEFAULTS.volcengineRegion;
    els.volcProject.value = APP_DEFAULTS.volcengineProject;
    els.mimoBaseUrl.value = APP_DEFAULTS.mimoPaygUrl;
    updateCredentialFields();
    await loadBackendState({quiet:true});
    els.accountDialog.close();
    showToast(provider === "volcengine" ? t("connectArk", { count: result.account.products?.length || 0 }) : provider === "openai" ? t("connectOpenAi") : provider === "mimo" ? t("connectMimo") : provider === "kimi" ? t("connectKimi") : provider === "siliconflow" ? t("connectSiliconFlow") : provider === "bailian" ? t("connectBailian") : provider === "openrouter" ? t("connectOpenRouter") : t("connectDeepSeek"));
  } catch (error) { showToast(errorMessage(error)); }
  finally {
    button.disabled = false;
    button.classList.remove("loading");
  button.querySelector("span").textContent = t("accountConnectVerify");
  }
});
els.syncAccountsButton.addEventListener("click", () => els.refreshButton.click());
els.retryFailedButton.addEventListener("click", async () => {
  const failed = (state.backend.accounts || []).filter(account => account.enabled !== false && account.lastError);
  if (!failed.length) { showToast(t("retryNone")); return; }
  els.retryFailedButton.disabled = true;
  els.retryFailedButton.textContent = t("workingRetry", { current: 0, total: failed.length });
  startSyncPolling();
  let succeeded = 0;
  for (let index = 0; index < failed.length; index++) {
  els.retryFailedButton.textContent = t("workingRetry", { current: index + 1, total: failed.length });
    try { await apiRequest(`/api/accounts/${failed[index].id}/sync`, { method:"POST" }); succeeded++; } catch (_) {}
  }
  await loadBackendState({quiet:true});
  stopSyncPolling();
  els.retryFailedButton.textContent = t("accountRetryFailed");
  renderAccounts();
  showToast(succeeded === failed.length ? t("retryRecovered", { count: succeeded }) : t("retryResult", { succeeded, failed: failed.length - succeeded }));
});
els.exportProductButton.addEventListener("click", exportCurrentProduct);
els.dialogClose.addEventListener("click",()=>els.metricDialog.close());
els.diagnosticDialogClose.addEventListener("click",()=>els.diagnosticDialog.close());
els.diagnosticDialogDone.addEventListener("click",()=>els.diagnosticDialog.close());
els.copyDiagnosticButton.addEventListener("click", async () => {
  const account = (state.backend.accounts || []).find(item => item.id === state.diagnosticAccountId);
  if (!account) return;
  const text = JSON.stringify(diagnosticPayload(account), null, 2);
  try { await navigator.clipboard.writeText(text); showToast(t("diagnosticCopied")); }
  catch (_) { downloadText(`Prismeter-diagnostic-${safeFilePart(account.name)}.json`, text, "application/json;charset=utf-8"); showToast(t("diagnosticExported")); }
});
els.addAccountButton.addEventListener("click",()=>{ updateCredentialFields(); els.accountDialog.showModal(); });
els.accountDialogClose.addEventListener("click",()=>els.accountDialog.close());
els.accountAlertsDialogClose.addEventListener("click",()=>els.accountAlertsDialog.close());
els.accountAlertsCancel.addEventListener("click",()=>els.accountAlertsDialog.close());
els.accountAlertsEnabled.addEventListener("change",updateAccountAlertFieldState);
els.deleteAccountDialogClose.addEventListener("click",()=>els.deleteAccountDialog.close());
els.deleteAccountCancel.addEventListener("click",()=>els.deleteAccountDialog.close());
els.renameAccountDialogClose.addEventListener("click",()=>els.renameAccountDialog.close());
els.renameAccountCancel.addEventListener("click",()=>els.renameAccountDialog.close());
els.connectionDialogClose.addEventListener("click",()=>els.connectionDialog.close());
els.connectionDialogCancel.addEventListener("click",()=>els.connectionDialog.close());
els.connectionForm.addEventListener("submit", async event => {
  event.preventDefault();
  const account = (state.backend.accounts || []).find(item => item.id === state.connectionAccountId);
  if (!account) return;
  const button = els.connectionSave;
  button.disabled = true;
  button.querySelector("span").textContent = t("workingVerify");
  const body = account.provider === "volcengine"
    ? { accessKey:els.editVolcAccessKey.value, secretKey:els.editVolcSecretKey.value, region:els.editVolcRegion.value, projectName:els.editVolcProject.value }
    : account.provider === "mimo"
      ? { apiKey:els.editMimoApiKey.value, baseUrl:els.editMimoBaseUrl.value }
      : { apiKey:els.editAccountKey.value };
  startSyncPolling();
  try {
    await apiRequest(`/api/accounts/${account.id}/connection`, { method:"PUT", body:JSON.stringify(body) });
    await loadBackendState({quiet:true});
    els.connectionDialog.close();
    showToast(t("connectionUpdated", { provider: providers[account.provider]?.name || account.provider }));
  } catch (error) { showToast(errorMessage(error)); }
  finally { stopSyncPolling(); button.disabled = false; button.querySelector("span").textContent = t("connectionSave"); }
});
els.renameAccountForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.renameAccountId) return;
  const button = els.renameAccountSave;
  button.disabled = true;
  button.querySelector("span").textContent = t("workingSave");
  try {
    await apiRequest(`/api/accounts/${state.renameAccountId}`, { method:"PATCH", body:JSON.stringify({name:els.renameAccountName.value}) });
    await loadBackendState({quiet:true});
    els.renameAccountDialog.close();
    showToast(t("accountNameUpdated"));
  } catch (error) { showToast(errorMessage(error)); }
  finally { button.disabled = false; button.querySelector("span").textContent = t("renameSave"); }
});
els.accountAlertsForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.alertAccountId) return;
  const button = els.accountAlertsSave;
  const optionalNumber = input => input.value.trim() === "" ? null : Number(input.value);
  if (!els.accountLowBalanceThreshold.checkValidity() || !els.accountUsageThreshold.checkValidity()) {
    showToast(t("alertThresholdInvalid"), "error");
    return;
  }
  button.disabled = true;
  button.querySelector("span").textContent = t("workingApply");
  try {
    await apiRequest(`/api/accounts/${state.alertAccountId}/alerts`, {
      method:"PUT",
      body:JSON.stringify({
        enabled:els.accountAlertsEnabled.checked,
        lowBalanceThreshold:optionalNumber(els.accountLowBalanceThreshold),
        usageThreshold:optionalNumber(els.accountUsageThreshold),
        staleAfterMinutes:els.accountStaleAfterMinutes.value === "" ? null : Number(els.accountStaleAfterMinutes.value)
      })
    });
    await loadBackendState({quiet:true});
    els.accountAlertsDialog.close();
    showToast(t("alertRulesUpdated"));
  } catch (error) { showToast(errorMessage(error, t("alertRulesUpdateFailed")), "error"); }
  finally { button.disabled = false; button.querySelector("span").textContent = t("accountApplyRules"); }
});
els.deleteAccountConfirm.addEventListener("click", async () => {
  const accountId = state.deleteAccountId;
  if (!accountId) { els.deleteAccountDialog.close(); return; }
  const button = els.deleteAccountConfirm;
  button.disabled = true;
  button.querySelector("span").textContent = t("workingRemove");
  try {
    await apiRequest(`/api/accounts/${accountId}`, { method:"DELETE" });
    state.metricHistoryCache.clear();
    state.deleteAccountId = null;
    await loadBackendState({quiet:true});
    els.deleteAccountDialog.close();
    showToast(t("accountRemoved"));
  } catch (error) {
    showToast(errorMessage(error, t("accountRemoveFailed")), "error");
  } finally {
    button.disabled = false;
  button.querySelector("span").textContent = t("confirmRemove");
  }
});
els.testNotificationButton.addEventListener("click", async () => {
  const button = els.testNotificationButton;
  button.disabled = true;
  button.textContent = t("testNotificationSending");
  try {
    await apiRequest("/api/notifications/test", { method:"POST" });
    showToast(t("testNotificationSent"));
  } catch (error) { showToast(errorMessage(error)); }
  finally { button.disabled = false; button.textContent = t("settingsTestNotification"); }
});
els.checkUpdateButton.addEventListener("click", () => checkForUpdates({manual:true}));
els.updateDialogClose.addEventListener("click", () => els.updateDialog.close());
els.laterUpdateButton.addEventListener("click", () => els.updateDialog.close());
els.skipUpdateButton.addEventListener("click", () => {
  if (!state.availableUpdate || !state.backend.settings) return;
  state.backend.settings.skippedUpdateVersion = state.availableUpdate.version;
  queueSettingsSave();
  els.updateDialog.close();
  setUpdateStatus(t("updateSkippedStatus", { version: state.availableUpdate.version }));
  showToast(t("updateSkipped", { version: state.availableUpdate.version }), "info");
});
els.installUpdateButton.addEventListener("click", () => {
  if (state.availableUpdate) installAvailableUpdate();
  else checkForUpdates({manual:true});
});
els.clearHistoryButton.addEventListener("click", () => {
  const storage = state.backend.historyStorage || {};
  const balanceSnapshots = Number(storage.balanceSnapshots || 0);
  const metricSnapshots = Number(storage.metricSnapshots || 0);
  const syncEvents = Number(storage.syncEvents || 0);
  els.clearHistoryDialogSummary.textContent = t("clearHistorySummary", { metrics: metricSnapshots, balances: balanceSnapshots, syncs: syncEvents });
  els.clearHistoryDialog.showModal();
});
els.clearHistoryDialogClose.addEventListener("click", () => els.clearHistoryDialog.close());
els.clearHistoryCancel.addEventListener("click", () => els.clearHistoryDialog.close());
els.clearHistoryConfirm.addEventListener("click", async () => {
  const button = els.clearHistoryConfirm;
  button.disabled = true;
  button.querySelector("span").textContent = t("workingClear");
  try {
    const result = await apiRequest("/api/history", { method:"DELETE" });
    const removed = Number(result.removed?.balanceSnapshots || 0) + Number(result.removed?.metricSnapshots || 0) + Number(result.removed?.syncEvents || 0);
    state.metricHistoryCache.clear();
    await loadBackendState({quiet:true});
    els.clearHistoryDialog.close();
    showToast(removed ? t("historyCleared", { count: removed }) : t("historyNothingToClear"), removed ? "success" : "info");
  } catch (error) {
    showToast(errorMessage(error, t("historyClearFailed")), "error");
  } finally {
    button.disabled = false;
  button.querySelector("span").textContent = t("confirmClear");
  }
});
els.exitAppButton.addEventListener("click", async () => {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) { showToast(t("desktopOnlyExit"), "info"); return; }
  els.exitAppButton.disabled = true;
  els.exitAppButton.textContent = t("workingExit");
  try { await invoke("exit_app"); }
  catch (error) {
    els.exitAppButton.disabled = false;
    els.exitAppButton.textContent = t("trayQuit");
    showToast(errorMessage(error, t("exitFailed")), "error");
  }
});

let settingsSaveTimer = null;
let settingsSaveRunning = false;
let settingsSaveQueued = false;

function settingsPayload() {
  return {
    autoSyncMinutes:Number(els.autoSyncMinutes.value),
    lowBalanceThreshold:Number(els.lowBalanceThreshold.value),
    usageThreshold:Number(els.usageThreshold.value),
    notificationsEnabled:els.notificationsEnabled.checked,
    interfaceLanguage:els.interfaceLanguage.value,
    appearanceMode:els.appearanceMode.value,
    syncOnStartup:els.syncOnStartup.checked,
    closeToTray:els.closeToTray.checked,
    launchAtStartup:els.launchAtStartup.checked,
    updateCheckMode:els.updateCheckMode.value,
    skippedUpdateVersion:state.backend.settings?.skippedUpdateVersion || "",
    historyRetentionDays:Number(els.historyRetentionDays.value),
    staleAfterMinutes:Number(els.staleAfterMinutes.value)
  };
}

function setSettingsSaveStatus(text, tone = "idle") {
  els.settingsSaveStatus.className = `settings-save-status ${tone}`;
  els.settingsSaveStatus.lastChild.textContent = text;
}

function queueSettingsSave(delay = 0) {
  if (!state.backend.settings) return;
  clearTimeout(settingsSaveTimer);
  setSettingsSaveStatus(t("settingsPending"), "pending");
  if (delay === "immediate") {
    settingsSaveQueued = true;
    return flushSettingsSave();
  }
  settingsSaveTimer = setTimeout(() => {
    settingsSaveQueued = true;
    flushSettingsSave();
  }, delay);
}

async function flushSettingsSave() {
  if (settingsSaveRunning || !settingsSaveQueued) return;
  settingsSaveQueued = false;
  settingsSaveRunning = true;
  setSettingsSaveStatus(t("settingsSaving"), "saving");
  const previousSettings = state.backend.settings;
  const nextSettings = settingsPayload();
  const retentionChanged = previousSettings?.historyRetentionDays !== nextSettings.historyRetentionDays;
  const strictDesktopKeys = ["closeToTray", "launchAtStartup"].filter(key => previousSettings?.[key] !== nextSettings[key]);
  try {
    if (strictDesktopKeys.length) await syncDesktopPreferences(nextSettings, strictDesktopKeys, strictDesktopKeys);
    const result = await apiRequest("/api/settings", { method:"PUT", body:JSON.stringify(nextSettings) });
    state.backend.settings = result.settings;
    if (nextSettings.interfaceLanguage === els.interfaceLanguage.value) state.languagePreferenceDirty = false;
    applyTheme(result.settings.appearanceMode || "system");
    els.syncText.textContent = formatSyncSetting();
    if (retentionChanged) await loadBackendState({quiet:true});
    setSettingsSaveStatus(t("settingsSaved"), "saved");
  } catch (error) {
    strictDesktopKeys.forEach(key => { state.desktopPreferences[key] = null; });
    if (strictDesktopKeys.length) await syncDesktopPreferences(previousSettings, [], strictDesktopKeys);
    populateSettings();
    applyTheme(state.backend.settings?.appearanceMode || "system");
    setSettingsSaveStatus(t("settingsSaveFailed"), "error");
    showToast(errorMessage(error), "error");
  } finally {
    settingsSaveRunning = false;
    if (settingsSaveQueued) flushSettingsSave();
  }
}

[els.notificationsEnabled, els.syncOnStartup, els.closeToTray, els.launchAtStartup].forEach(input => input.addEventListener("change", () => queueSettingsSave()));
[els.lowBalanceThreshold, els.usageThreshold].forEach(input => {
  input.addEventListener("input", () => { if (input.checkValidity() && input.value !== "") queueSettingsSave(450); });
  input.addEventListener("change", () => { if (input.checkValidity() && input.value !== "") queueSettingsSave(); });
});

async function bootstrapApplication() {
  runUiStateStep("initialize remote providers", initializeRemoteOnlyProviders);
  runUiStateStep("initialize deepseek", () => applyDeepSeekAccountData(null));
  runUiStateStep("initialize kimi", () => applyKimiAccountData(null));
  runUiStateStep("initialize siliconflow", () => applySiliconFlowAccountData(null));
  runUiStateStep("initialize bailian", () => applyBailianAccountData(null));
  runUiStateStep("initialize openrouter", () => applyOpenRouterAccountData(null));
  runUiStateStep("initialize openai", () => applyOpenAIAccountData(null));
  runUiStateStep("initialize volcengine", () => applyVolcengineAccountData(null));
  runUiStateStep("initialize credential fields", updateCredentialFields);
  runUiStateStep("initial language", () => applyInterfaceLanguage(state.interfaceLanguagePreference));
  interfaceLanguageObserver.observe(document.body, { childList:true, subtree:true, characterData:true });
  const backendStatePromise = loadBackendState();
  runUiStateStep("initial navigation", renderNavigation);
  runUiStateStep("initial overview", renderOverview);
  runUiStateStep("initial alerts", renderAlerts);
  runUiStateStep("initial comparisons", renderComparisons);
  runUiStateStep("initial accounts", renderAccounts);
  runUiStateStep("initial view", () => switchView("overview"));
  initializeSystemInterfaceLanguage().then(() => {
    if (state.interfaceLanguagePreference !== "system") return;
    applyInterfaceLanguage("system");
    rerenderForInterfaceLanguage();
  });
  await backendStatePromise;
}

bootstrapApplication().catch(error => console.error("Prismeter bootstrap failed", error));
setInterval(() => { if (!state.backend.accounts?.length) return; renderOverview(); renderAccounts(); renderAlerts(); if (state.view === "platforms") renderPlatform(); }, RELATIVE_TIME_REFRESH_MS);
setInterval(() => { if (state.backend.accounts?.length) loadBackendState({quiet:true}); }, BACKGROUND_STATE_REFRESH_MS);


















document.addEventListener("DOMContentLoaded",()=>{
  const api=window.__TAURI__?.window;
  const current=api?.getCurrentWindow?.();
  if(!current) return;
  if(document.documentElement.dataset.windowControlsBound) return;
  document.documentElement.dataset.windowControlsBound="true";
  const maximizeButton=document.getElementById("windowMaximize");
  let resizeStateTimer;
  const updateMaximizeState=async()=>{
    try {
      const maximized=await current.isMaximized();
      document.documentElement.classList.toggle("window-maximized",maximized);
      if(maximizeButton){
        const label=translateStatic(maximized?"还原":"最大化");
        maximizeButton.setAttribute("aria-label",label);
        maximizeButton.title=label;
      }
    } catch(error) { console.error("读取窗口状态失败",error); }
  };
  const runWindowAction=action=>async event=>{
    event.preventDefault();
    event.stopPropagation();
    try {
      await current[action]();
      if(action==="toggleMaximize") await updateMaximizeState();
    }
    catch(error) {
      console.error(`窗口操作 ${action} 失败`,error);
      showToast(errorMessage(error, t("windowOperationFailed")), "error");
    }
  };
  document.getElementById("windowMinimize")?.addEventListener("click",runWindowAction("minimize"));
  maximizeButton?.addEventListener("click",runWindowAction("toggleMaximize"));
  document.getElementById("windowClose")?.addEventListener("click",runWindowAction("close"));
  document.querySelector(".window-chrome")?.addEventListener("dblclick",event=>{
    if(!event.target.closest(".window-controls")) runWindowAction("toggleMaximize")(event);
  });
  document.querySelectorAll("[data-resize-direction]").forEach(handle=>{
    handle.addEventListener("pointerdown",async event=>{
      if(event.button!==0 || document.documentElement.classList.contains("window-maximized")) return;
      event.preventDefault();
      try { await current.startResizeDragging(handle.dataset.resizeDirection); }
      catch(error) { console.error("窗口缩放失败",error); }
    });
  });
  window.addEventListener("resize",()=>{
    clearTimeout(resizeStateTimer);
    resizeStateTimer=setTimeout(updateMaximizeState,80);
  });
  updateMaximizeState();
});

function bindWindowControlsFallback() {
  if (document.documentElement.dataset.windowControlsBound) return;
  const current = window.__TAURI__?.window?.getCurrentWindow?.();
  if (!current) return;
  document.documentElement.dataset.windowControlsBound = "true";
  const bind = (id, action) => document.getElementById(id)?.addEventListener("click", async event => {
    event.preventDefault(); event.stopPropagation();
    try { await current[action](); }
    catch (error) { console.error(`Window action ${action} failed`, error); }
  });
  bind("windowMinimize", "minimize");
  bind("windowMaximize", "toggleMaximize");
  bind("windowClose", "close");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindWindowControlsFallback, { once:true });
else bindWindowControlsFallback();
