// ===========================
// Application State
// ===========================
const state = {
    currentChapter: 0,
    settings: {
        theme: 'light',
        fontSize: 18,
        lineHeight: 1.7,
        contentWidth: 720,
        fontFamily: 'serif'
    },
    scrollPositions: {}
};

// ===========================
// DOM Elements
// ===========================
const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    chapterList: document.getElementById('chapterList'),
    content: document.getElementById('content'),
    toc: document.getElementById('toc'),
    tocNav: document.getElementById('tocNav'),
    themeToggle: document.getElementById('themeToggle'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsPanel: document.getElementById('settingsPanel'),
    closeSettings: document.getElementById('closeSettings'),
    readingProgress: document.getElementById('readingProgress'),
    prevChapter: document.getElementById('prevChapter'),
    nextChapter: document.getElementById('nextChapter'),
    mobileChapters: document.getElementById('mobileChapters'),
    mobileToc: document.getElementById('mobileToc'),
    mobileSettings: document.getElementById('mobileSettings'),
    // Header navigation
    headerPrev: document.getElementById('headerPrev'),
    headerNext: document.getElementById('headerNext'),
    chapterIndicator: document.getElementById('chapterIndicator'),
    // Settings controls
    fontDecrease: document.getElementById('fontDecrease'),
    fontIncrease: document.getElementById('fontIncrease'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    lineHeightDecrease: document.getElementById('lineHeightDecrease'),
    lineHeightIncrease: document.getElementById('lineHeightIncrease'),
    lineHeightValue: document.getElementById('lineHeightValue'),
    widthDecrease: document.getElementById('widthDecrease'),
    widthIncrease: document.getElementById('widthIncrease'),
    widthValue: document.getElementById('widthValue')
};

// ===========================
// Initialization
// ===========================
async function init() {
    loadSettings();
    applySettings();

    // Показываем индикатор загрузки
    showLoadingIndicator();

    try {
        // Инициализируем систему загрузки контента
        await initBookContent();

        renderChapterList();
        await loadLastPosition();
        setupEventListeners();
        updateChapterNavButtons();
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Ошибка загрузки книги. Пожалуйста, обновите страницу.');
    } finally {
        hideLoadingIndicator();
    }
}

// Показать индикатор загрузки
function showLoadingIndicator() {
    elements.content.innerHTML = `
        <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <p>Загрузка главы...</p>
        </div>
    `;
}

// Скрыть индикатор загрузки
function hideLoadingIndicator() {
    const indicator = elements.content.querySelector('.loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Показать ошибку
function showError(message) {
    elements.content.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
        </div>
    `;
}

// ===========================
// Settings Management
// ===========================
function loadSettings() {
    const saved = localStorage.getItem('bookReaderSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.settings = { ...state.settings, ...parsed };
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }

    const savedPositions = localStorage.getItem('bookReaderPositions');
    if (savedPositions) {
        try {
            state.scrollPositions = JSON.parse(savedPositions);
        } catch (e) {
            console.error('Error loading positions:', e);
        }
    }
}

function saveSettings() {
    localStorage.setItem('bookReaderSettings', JSON.stringify(state.settings));
}

function savePositions() {
    localStorage.setItem('bookReaderPositions', JSON.stringify(state.scrollPositions));
}

function applySettings() {
    // Theme
    document.documentElement.setAttribute('data-theme', state.settings.theme);

    // Typography
    document.documentElement.style.setProperty('--font-size-base', `${state.settings.fontSize}px`);
    document.documentElement.style.setProperty('--line-height-base', state.settings.lineHeight);
    document.documentElement.style.setProperty('--content-width', `${state.settings.contentWidth}px`);

    // Font family
    document.body.classList.toggle('font-sans', state.settings.fontFamily === 'sans');

    // Update UI values
    elements.fontSizeValue.textContent = `${state.settings.fontSize}px`;
    elements.lineHeightValue.textContent = state.settings.lineHeight.toFixed(1);
    elements.widthValue.textContent = `${state.settings.contentWidth}px`;

    // Update font buttons
    document.querySelectorAll('.btn-font').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.font === state.settings.fontFamily);
    });

    // Update theme buttons
    document.querySelectorAll('.btn-theme-fun').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
    });
}

// ===========================
// Chapter Management
// ===========================
function renderChapterList() {
    elements.chapterList.innerHTML = '';

    // Восстанавливаем заголовок sidebar (на случай если был показан TOC)
    const sidebarTitle = elements.sidebar.querySelector('h2');
    if (sidebarTitle) {
        sidebarTitle.textContent = 'Оглавление';
    }

    bookContent.forEach((chapter, index) => {
        const btn = document.createElement('button');
        btn.className = `chapter-item${index === state.currentChapter ? ' active' : ''}`;
        btn.innerHTML = `<span class="chapter-number">${index + 1}.</span> ${chapter.title}`;
        btn.addEventListener('click', () => navigateToChapter(index));
        elements.chapterList.appendChild(btn);
    });
}

async function navigateToChapter(index) {
    // Save current position
    state.scrollPositions[state.currentChapter] = window.scrollY;
    savePositions();

    // Update state
    state.currentChapter = index;
    localStorage.setItem('bookReaderCurrentChapter', index);

    // Show loading indicator
    showLoadingIndicator();

    try {
        // Render new chapter (async)
        await renderChapter(index);

        // Update sidebar
        document.querySelectorAll('.chapter-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        // Always scroll to top of chapter
        window.scrollTo(0, 0);
    } catch (error) {
        console.error('Error loading chapter:', error);
        showError('Ошибка загрузки главы');
    } finally {
        hideLoadingIndicator();
    }

    // Close sidebar on mobile
    closeSidebar();

    // Update navigation buttons
    updateChapterNavButtons();
}

async function renderChapter(index) {
    // Загружаем контент главы (с кэшированием)
    const chapter = await loadChapterContent(index);

    if (!chapter || !chapter.content) {
        throw new Error('Chapter content is empty');
    }

    // Convert markdown-like content to HTML
    let html = parseContent(chapter.content);

    elements.content.innerHTML = html;

    // Generate TOC
    generateTOC();
}

function parseContent(content) {
    // Configure marked options
    marked.setOptions({
        gfm: true,            // GitHub Flavored Markdown
        breaks: true,         // Convert \n to <br>
        headerIds: false,     // We generate our own IDs for TOC
        mangle: false         // Don't mangle email addresses
    });

    // Parse markdown to HTML using marked.js
    return marked.parse(content);
}

function generateTOC() {
    const headings = elements.content.querySelectorAll('h2, h3');
    elements.tocNav.innerHTML = '';

    headings.forEach((heading, index) => {
        // Add ID for linking
        const id = `section-${index}`;
        heading.id = id;

        const link = document.createElement('a');
        link.className = `toc-item level-${heading.tagName.toLowerCase().slice(1)}`;
        link.href = `#${id}`;
        link.textContent = heading.textContent;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth' });

            // Close TOC on mobile if open
            closeSidebar();
        });

        elements.tocNav.appendChild(link);
    });
}

function updateChapterNavButtons() {
    const isFirst = state.currentChapter === 0;
    const isLast = state.currentChapter === bookContent.length - 1;

    // Update bottom navigation
    elements.prevChapter.disabled = isFirst;
    elements.nextChapter.disabled = isLast;

    // Update header navigation
    elements.headerPrev.disabled = isFirst;
    elements.headerNext.disabled = isLast;

    // Update chapter indicator
    elements.chapterIndicator.textContent = `${state.currentChapter + 1} / ${bookContent.length}`;
}

async function loadLastPosition() {
    const lastChapter = localStorage.getItem('bookReaderCurrentChapter');
    if (lastChapter !== null) {
        state.currentChapter = parseInt(lastChapter, 10);
    }

    await renderChapter(state.currentChapter);

    // Restore scroll position
    const savedPosition = state.scrollPositions[state.currentChapter];
    if (savedPosition) {
        setTimeout(() => window.scrollTo(0, savedPosition), 100);
    }
}

// ===========================
// UI Interactions
// ===========================
function toggleSidebar() {
    elements.sidebar.classList.toggle('active');
    elements.sidebarOverlay.classList.toggle('active');
}

function closeSidebar() {
    elements.sidebar.classList.remove('active');
    elements.sidebarOverlay.classList.remove('active');
}

function toggleSettings() {
    elements.settingsPanel.classList.toggle('active');
}

function closeSettings() {
    elements.settingsPanel.classList.remove('active');
}

function toggleTheme() {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applySettings();
    saveSettings();
}

// ===========================
// Reading Progress
// ===========================
function updateReadingProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    elements.readingProgress.style.width = `${Math.min(progress, 100)}% `;
}

// ===========================
// TOC Active State
// ===========================
function updateActiveTocItem() {
    const headings = elements.content.querySelectorAll('h2, h3');
    const tocItems = elements.tocNav.querySelectorAll('.toc-item');

    let currentActive = null;

    headings.forEach((heading, index) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 150) {
            currentActive = index;
        }
    });

    tocItems.forEach((item, index) => {
        item.classList.toggle('active', index === currentActive);
    });
}

// ===========================
// Event Listeners
// ===========================
function setupEventListeners() {
    // Sidebar
    elements.sidebarToggle.addEventListener('click', toggleSidebar);
    elements.sidebarOverlay.addEventListener('click', closeSidebar);

    // Theme
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Settings
    elements.settingsBtn.addEventListener('click', toggleSettings);
    elements.closeSettings.addEventListener('click', closeSettings);

    // Font size
    elements.fontDecrease.addEventListener('click', () => {
        if (state.settings.fontSize > 14) {
            state.settings.fontSize -= 2;
            applySettings();
            saveSettings();
        }
    });

    elements.fontIncrease.addEventListener('click', () => {
        if (state.settings.fontSize < 28) {
            state.settings.fontSize += 2;
            applySettings();
            saveSettings();
        }
    });

    // Line height
    elements.lineHeightDecrease.addEventListener('click', () => {
        if (state.settings.lineHeight > 1.3) {
            state.settings.lineHeight = Math.round((state.settings.lineHeight - 0.1) * 10) / 10;
            applySettings();
            saveSettings();
        }
    });

    elements.lineHeightIncrease.addEventListener('click', () => {
        if (state.settings.lineHeight < 2.2) {
            state.settings.lineHeight = Math.round((state.settings.lineHeight + 0.1) * 10) / 10;
            applySettings();
            saveSettings();
        }
    });

    // Content width
    elements.widthDecrease.addEventListener('click', () => {
        if (state.settings.contentWidth > 550) {
            state.settings.contentWidth -= 50;
            applySettings();
            saveSettings();
        }
    });

    elements.widthIncrease.addEventListener('click', () => {
        if (state.settings.contentWidth < 900) {
            state.settings.contentWidth += 50;
            applySettings();
            saveSettings();
        }
    });

    // Font family
    document.querySelectorAll('.btn-font').forEach(btn => {
        btn.addEventListener('click', () => {
            state.settings.fontFamily = btn.dataset.font;
            applySettings();
            saveSettings();
        });
    });

    // Theme toggle in settings
    document.querySelectorAll('.btn-theme-fun').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            state.settings.theme = theme;  // Update state
            applySettings();
            saveSettings();

            // Update button states
            document.querySelectorAll('.btn-theme-fun').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Chapter navigation (bottom buttons)
    elements.prevChapter.addEventListener('click', () => {
        if (state.currentChapter > 0) {
            navigateToChapter(state.currentChapter - 1);
        }
    });

    elements.nextChapter.addEventListener('click', () => {
        if (state.currentChapter < bookContent.length - 1) {
            navigateToChapter(state.currentChapter + 1);
        }
    });

    // Header navigation buttons
    elements.headerPrev.addEventListener('click', () => {
        if (state.currentChapter > 0) {
            navigateToChapter(state.currentChapter - 1);
        }
    });

    elements.headerNext.addEventListener('click', () => {
        if (state.currentChapter < bookContent.length - 1) {
            navigateToChapter(state.currentChapter + 1);
        }
    });

    // Mobile navigation
    elements.mobileChapters.addEventListener('click', () => {
        // Ensure chapters list is shown (not TOC)
        renderChapterList();
        toggleSidebar();
    });

    elements.mobileToc.addEventListener('click', () => {
        // Show TOC in sidebar on mobile
        const tocHtml = elements.tocNav.innerHTML;
        elements.chapterList.innerHTML = tocHtml;
        elements.sidebar.querySelector('h2').textContent = 'В этой главе';
        toggleSidebar();
    });
    elements.mobileSettings.addEventListener('click', toggleSettings);

    // Scroll events
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        updateReadingProgress();
        updateActiveTocItem();

        // Save position periodically
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            state.scrollPositions[state.currentChapter] = window.scrollY;
            savePositions();
        }, 500);
    });

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.settingsPanel.contains(e.target) &&
            !elements.settingsBtn.contains(e.target) &&
            !elements.mobileSettings.contains(e.target)) {
            closeSettings();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && state.currentChapter > 0) {
            navigateToChapter(state.currentChapter - 1);
        } else if (e.key === 'ArrowRight' && state.currentChapter < bookContent.length - 1) {
            navigateToChapter(state.currentChapter + 1);
        } else if (e.key === 'Escape') {
            closeSidebar();
            closeSettings();
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
