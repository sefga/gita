// ===========================
// Content Loader Module
// ===========================
// Система дробной загрузки контента книги
// Каждая глава хранится в отдельном JSON-файле и загружается по требованию

class ChapterLoader {
    constructor(basePath = './content/') {
        this.basePath = basePath;
        this.manifest = null;
        this.cache = new Map(); // Кэш загруженных глав
        this.isInitialized = false;
    }

    // Инициализация — загрузка манифеста
    async init() {
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
    }

    // Получить список глав (только метаданные, без контента)
    getChaptersList() {
        if (!this.manifest) {
            throw new Error('ChapterLoader not initialized. Call init() first.');
        }
        return this.manifest.chapters.map(ch => ({
            id: ch.id,
            title: ch.title,
            subtitle: ch.subtitle
        }));
    }

    // Загрузить конкретную главу
    async loadChapter(chapterIndex) {
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
    }

    // Предзагрузка следующей главы (для плавной навигации)
    async preloadNext(currentIndex) {
        const nextIndex = currentIndex + 1;
        if (nextIndex < this.manifest.chapters.length && !this.cache.has(nextIndex)) {
            // Загружаем в фоне, не блокируя
            this.loadChapter(nextIndex).catch(() => {
                // Игнорируем ошибки предзагрузки
            });
        }
    }

    // Количество глав
    get chaptersCount() {
        return this.manifest?.chapters?.length || 0;
    }

    // Получить название книги
    get bookTitle() {
        return this.manifest?.title || 'Книга';
    }
}

// Глобальный экземпляр
const chapterLoader = new ChapterLoader();

// Совместимость со старым API — создаём массив bookContent
// который заполняется по мере загрузки глав
let bookContent = [];

// Функция инициализации для использования в app.js
async function initBookContent() {
    await chapterLoader.init();

    // Создаём массив-заглушку с метаданными
    bookContent = chapterLoader.getChaptersList().map(ch => ({
        title: ch.title,
        subtitle: ch.subtitle,
        content: null, // Контент загружается по требованию
        loaded: false
    }));

    return bookContent;
}

// Функция загрузки контента главы
async function loadChapterContent(index) {
    if (bookContent[index]?.loaded) {
        return bookContent[index];
    }

    const chapter = await chapterLoader.loadChapter(index);
    bookContent[index] = {
        ...bookContent[index],
        content: chapter.content,
        loaded: true
    };

    // Предзагружаем следующую главу
    chapterLoader.preloadNext(index);

    return bookContent[index];
}
