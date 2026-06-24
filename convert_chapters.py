import os
import json
import re

# Настройки путей
INPUT_DIR = "С номерами стихов"
OUTPUT_DIR = "content"

# Метаданные глав Бхагавад-Гиты
GITA_METADATA = {
    1: {
        "title": "Глава 1. Арджуна-вишада-йога",
        "subtitle": "Йога отчаяния Арджуны"
    },
    2: {
        "title": "Глава 2. Санкхья-йога",
        "subtitle": "Йога познания (Краткое изложение)"
    },
    3: {
        "title": "Глава 3. Карма-йога",
        "subtitle": "Йога действия (Путь бескорыстного труда)"
    },
    4: {
        "title": "Глава 4. Джнана-карма-санньяса-йога",
        "subtitle": "Йога знания и отречения от деятельности"
    },
    5: {
        "title": "Глава 5. Карма-санньяса-йога",
        "subtitle": "Йога отречения от действия"
    },
    6: {
        "title": "Глава 6. Дхьяна-йога (Атма-самьяма-йога)",
        "subtitle": "Йога самоконтроля (медитации)"
    },
    7: {
        "title": "Глава 7. Джнана-виджняна-йога",
        "subtitle": "Йога знания об Абсолюте (познание истины)"
    },
    8: {
        "title": "Глава 8. Акшара-брахма-йога",
        "subtitle": "Йога достижения вечного Брахмана"
    },
    9: {
        "title": "Глава 9. Раджа-видья-раджа-гухья-йога",
        "subtitle": "Йога царственного знания и сокровенной тайны"
    },
    10: {
        "title": "Глава 10. Вибхути-йога",
        "subtitle": "Йога божественных достояний (Великолепие Абсолюта)"
    },
    11: {
        "title": "Глава 11. Вишварупа-даршана-йога",
        "subtitle": "Йога созерцания вселенской формы"
    },
    12: {
        "title": "Глава 12. Бхакти-йога",
        "subtitle": "Йога преданного служения"
    },
    13: {
        "title": "Глава 13. Кшетра-кшетрагья-вибхага-йога",
        "subtitle": "Йога различения поля и знатока поля"
    },
    14: {
        "title": "Глава 14. Гуна-трайя-вибхага-йога",
        "subtitle": "Йога различения трех гун материальной природы"
    },
    15: {
        "title": "Глава 15. Пурушоттама-йога",
        "subtitle": "Йога высшей личности"
    },
    16: {
        "title": "Глава 16. Дайва-асура-сампада-вибхага-йога",
        "subtitle": "Йога различения божественных и демонических качеств"
    },
    17: {
        "title": "Глава 17. Шраддха-трайя-вибхага-йога",
        "subtitle": "Йога различения трех видов веры"
    },
    18: {
        "title": "Глава 18. Мокша-санньяса-йога",
        "subtitle": "Йога освобождения и совершенства отречения"
    }
}

def extract_chapter_num(filename):
    """Извлекает номер главы из имени файла"""
    match = re.match(r'(\d+)', filename)
    return int(match.group(1)) if match else 0

def format_content(text, chapter_num, title, subtitle):
    """Форматирует текст главы, разбивая на абзацы по номерам стихов"""
    # Очищаем лишние пробелы в начале и конце
    text = text.strip()
    
    # 1. Заменяем пробелы перед номерами стихов на перенос строки и выделяем жирным
    # Паттерн ищет пробел(ы) перед номером стиха вида "1.1." или "1.16-18."
    formatted = re.sub(r'\s+(\b\d+\.\d+(?:-\d+)?\.)\s*', r'\n\n**\1** ', text)
    
    # 2. Выделяем жирным номер самого первого стиха в начале строки
    formatted = re.sub(r'^(\b\d+\.\d+(?:-\d+)?\.)\s*', r'**\1** ', formatted)
    
    # 3. Собираем финальный Markdown для главы
    markdown_content = f"# **{title}**\n\n*{subtitle}*\n\n---\n\n{formatted}"
    
    return markdown_content

def main():
    print("Начало конвертации глав Бхагавад-Гиты...")
    
    # Создаем выходную директорию
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Получаем и сортируем файлы глав
    files = [f for f in os.listdir(INPUT_DIR) if f.endswith(".md")]
    files = sorted(files, key=extract_chapter_num)
    
    manifest_chapters = []
    
    for filename in files:
        chapter_num = extract_chapter_num(filename)
        if chapter_num == 0 or chapter_num not in GITA_METADATA:
            print(f"Пропуск файла: {filename} (неверный номер главы)")
            continue
            
        meta = GITA_METADATA[chapter_num]
        filepath = os.path.join(INPUT_DIR, filename)
        
        print(f"Обработка главы {chapter_num}: {filename}...")
        
        with open(filepath, "r", encoding="utf-8") as f:
            raw_text = f.read()
            
        # Форматируем текст главы
        formatted_text = format_content(raw_text, chapter_num, meta["title"], meta["subtitle"])
        
        # Записываем JSON главы
        chapter_data = {
            "id": chapter_num,
            "title": meta["title"],
            "content": formatted_text
        }
        
        json_filename = f"chapter-{chapter_num}.json"
        json_filepath = os.path.join(OUTPUT_DIR, json_filename)
        
        with open(json_filepath, "w", encoding="utf-8") as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
            
        # Добавляем в манифест
        manifest_chapters.append({
            "id": chapter_num,
            "title": meta["title"],
            "subtitle": meta["subtitle"],
            "file": json_filename
        })
        
    # Генерируем manifest.json
    manifest_data = {
        "title": "Бхагавад-Гита",
        "author": "Вьясадева",
        "version": "1.0",
        "chapters": manifest_chapters
    }
    
    manifest_filepath = os.path.join(OUTPUT_DIR, "manifest.json")
    with open(manifest_filepath, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        
    print(f"\n[OK] Успешно завершено! Сгенерировано {len(manifest_chapters)} глав.")
    print(f"Манифест сохранен в {manifest_filepath}")

if __name__ == "__main__":
    main()
