import os
import json
import urllib.request
import re

# Настройки
OUTPUT_DIR = "standalone"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "gita.html")
MARKED_CDN_URL = "https://cdn.jsdelivr.net/npm/marked/marked.min.js"

def download_marked():
    """Скачивает marked.min.js из CDN"""
    print("Скачивание библиотеки marked.js...")
    try:
        with urllib.request.urlopen(MARKED_CDN_URL) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Ошибка при скачивании marked.js: {e}")
        print("Попытка загрузить из локального кэша или интернет-ресурса не удалась.")
        raise

def gather_book_data():
    """Собирает manifest.json и все chapter-*.json в единый словарь"""
    print("Сбор контента книги...")
    data = {
        "manifest": None,
        "chapters": {}
    }
    
    # Читаем manifest.json
    manifest_path = os.path.join("content", "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        data["manifest"] = json.load(f)
        
    # Читаем все главы, упомянутые в манифесте
    for ch in data["manifest"]["chapters"]:
        filename = ch["file"]
        chapter_path = os.path.join("content", filename)
        with open(chapter_path, "r", encoding="utf-8") as f:
            data["chapters"][filename] = json.load(f)
            
    return data

def main():
    print("Начало сборки автономного (standalone) файла Бхагавад-Гиты...")
    
    # Создаем папку standalone
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 1. Скачиваем marked.js
    marked_js = download_marked()
    
    # 2. Собираем данные книги
    book_data = gather_book_data()
    
    # 3. Читаем исходный index.html
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()
        
    # 4. Читаем стили styles.css
    with open("styles.css", "r", encoding="utf-8") as f:
        styles = f.read()
        
    # 5. Читаем content-loader.js и адаптируем его под оффлайн
    with open("content-loader.js", "r", encoding="utf-8") as f:
        loader_code = f.read()
        
    # Нормализуем переносы строк для надежной замены
    loader_code = loader_code.replace("\r\n", "\n")
    
    old_init = """    async init() {
        if (this.isInitialized) return this.manifest;

        try {
            const response = await fetch(`${this.basePath}manifest.json`);
            if (!response.ok) {
                throw new Error(`Failed to load manifest: ${response.status}`);
            }
            this.manifest = await response.json();
            this.isInitialized = true;
            console.log(`[ChapterLoader] Loaded manifest: ${this.manifest.chapters.length} chapters`);
            return this.manifest;
        } catch (error) {
            console.error('[ChapterLoader] Error loading manifest:', error);
            throw error;
        }
    }"""
    
    new_init = """    async init() {
        if (this.isInitialized) return this.manifest;
        this.manifest = GITA_DATA.manifest;
        this.isInitialized = true;
        console.log(`[ChapterLoader] Loaded manifest from memory: ${this.manifest.chapters.length} chapters`);
        return this.manifest;
    }"""
    
    old_load = """    async loadChapter(chapterIndex) {
        if (!this.manifest) {
            throw new Error('ChapterLoader not initialized. Call init() first.');
        }

        const chapterMeta = this.manifest.chapters[chapterIndex];
        if (!chapterMeta) {
            throw new Error(`Chapter ${chapterIndex} not found`);
        }

        // Проверяем кэш
        if (this.cache.has(chapterIndex)) {
            console.log(`[ChapterLoader] Chapter ${chapterIndex + 1} loaded from cache`);
            return this.cache.get(chapterIndex);
        }

        // Загружаем из файла
        try {
            console.log(`[ChapterLoader] Loading chapter ${chapterIndex + 1}...`);
            const response = await fetch(`${this.basePath}${chapterMeta.file}`);
            if (!response.ok) {
                throw new Error(`Failed to load chapter: ${response.status}`);
            }
            const chapter = await response.json();

            // Кэшируем
            this.cache.set(chapterIndex, chapter);
            console.log(`[ChapterLoader] Chapter ${chapterIndex + 1} loaded successfully`);

            return chapter;
        } catch (error) {
            console.error(`[ChapterLoader] Error loading chapter ${chapterIndex + 1}:`, error);
            throw error;
        }
    }"""
    
    new_load = """    async loadChapter(chapterIndex) {
        if (!this.manifest) {
            throw new Error('ChapterLoader not initialized. Call init() first.');
        }

        const chapterMeta = this.manifest.chapters[chapterIndex];
        if (!chapterMeta) {
            throw new Error(`Chapter ${chapterIndex} not found`);
        }

        if (this.cache.has(chapterIndex)) {
            return this.cache.get(chapterIndex);
        }

        const chapter = GITA_DATA.chapters[chapterMeta.file];
        if (!chapter) {
            throw new Error(`Chapter data for ${chapterMeta.file} not found in GITA_DATA`);
        }

        this.cache.set(chapterIndex, chapter);
        return chapter;
    }"""
    
    # Выполняем замену кода
    if old_init in loader_code:
        loader_code = loader_code.replace(old_init, new_init)
        print("[OK] Метод init() успешно заменен")
    else:
        print("[WARN] Ошибка: метод init() не найден для замены!")
        
    if old_load in loader_code:
        loader_code = loader_code.replace(old_load, new_load)
        print("[OK] Метод loadChapter() успешно заменен")
    else:
        print("[WARN] Ошибка: метод loadChapter() не найден для замены!")

    # 6. Читаем app.js
    with open("app.js", "r", encoding="utf-8") as f:
        app_code = f.read()

    # 7. Формируем единый HTML файл
    # Встраиваем CSS
    html = re.sub(
        r'<link rel="stylesheet" href="styles.css">',
        f"<style>\n{styles}\n</style>",
        html
    )
    
    # Встраиваем marked.js, GITA_DATA, content-loader.js и app.js в конец body
    scripts_replacement = f"""
    <!-- Встроенная библиотека Markdown Parser -->
    <script>
    {marked_js}
    </script>

    <!-- Встроенные данные книги Бхагавад-Гита -->
    <script>
    const GITA_DATA = {json.dumps(book_data, ensure_ascii=False, indent=2)};
    </script>

    <!-- Встроенная адаптированная логика загрузки -->
    <script>
    {loader_code}
    </script>

    <!-- Встроенная логика приложения -->
    <script>
    {app_code}
    </script>
    """
    
    # Заменяем три тега скриптов на наш единый блок встроенных скриптов
    # Ищем блок скриптов перед </body>
    pattern = r'<!-- Markdown Parser -->\s*<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>\s*<script src="content-loader.js"></script>\s*<script src="app.js"></script>'
    
    match = re.search(pattern, html)
    if match:
        html = html.replace(match.group(0), scripts_replacement)
        print("[OK] Скрипты успешно встроены")
    else:
        # Резервный вариант замены
        html = html.replace('<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>', f"<script>\n{marked_js}\n</script>")
        html = html.replace('<script src="content-loader.js"></script>', f"<script>\nconst GITA_DATA = {json.dumps(book_data, ensure_ascii=False, indent=2)};\n{loader_code}\n</script>")
        html = html.replace('<script src="app.js"></script>', f"<script>\n{app_code}\n</script>")
        print("[OK] Применен резервный вариант встраивания скриптов")
        
    # Записываем итоговый файл
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
        
    print(f"\n[OK] Сборка успешно завершена!")
    print(f"Автономный файл сохранен в: {OUTPUT_FILE} ({os.path.getsize(OUTPUT_FILE) // 1024} КБ)")

if __name__ == "__main__":
    main()
