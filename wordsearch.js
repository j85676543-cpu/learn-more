document.addEventListener('DOMContentLoaded', () => {
    const activeLinks = document.querySelectorAll('.button');
    activeLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === 'wordsearch.html');
    });

    const form = document.getElementById('wordSearchForm');
    const input = document.getElementById('wordInput');
    const suggestionsContainer = document.getElementById('suggestions');

    function decodeWordList(text) {
        const normalized = text.trim();
        if (!normalized) {
            return [];
        }

        try {
            const binary = atob(normalized);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes).split(/\r?\n/).filter(Boolean);
        } catch (error) {
            console.warn('Could not decode word list:', error);
            return normalized.split(/\r?\n/).filter(Boolean);
        }
    }

    function loadWordList() {
        return fetch('wordlist.txt')
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.text();
            })
            .then((text) => decodeWordList(text));
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(() => {
            console.warn('Clipboard access failed');
        });
    }

    function shuffleWords(items) {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function getFilteredWords(query, wordList) {
        const normalized = (query || '').trim().toLowerCase();
        if (!normalized) {
            return wordList;
        }

        const words = wordList.filter((word) => {
            const value = word.toLowerCase();

            if (normalized === '-longs') {
                return value.length >= 20;
            }

            if (normalized === '-shorts') {
                return value.length <= 5;
            }

            if (normalized.startsWith('^') && normalized.endsWith('$')) {
                const pattern = normalized.slice(1, -1);
                if (!pattern) return false;
                return new RegExp(`^${pattern}`).test(value) && new RegExp(`${pattern}$`).test(value);
            }

            if (normalized.startsWith('^')) {
                const pattern = normalized.slice(1);
                return new RegExp(`^${pattern}`).test(value);
            }

            if (normalized.endsWith('$')) {
                const pattern = normalized.slice(0, -1);
                return new RegExp(`${pattern}$`).test(value);
            }

            try {
                return new RegExp(normalized).test(value);
            } catch (error) {
                return value.includes(normalized);
            }
        });

        return words;
    }

    function renderSuggestions(query, wordList) {
        const normalized = (query || '').trim().toLowerCase();
        const allMatches = getFilteredWords(query, wordList);
        const matches = shuffleWords(allMatches).slice(0, 30);

        if (!allMatches.length) {
            suggestionsContainer.innerHTML = '<div class="empty-state">No matches yet. Try another pattern.</div>';
            return;
        }

        const label = normalized || 'All words';
        const countText = `<div class="empty-state" style="margin-top:0; margin-bottom:8px;">${allMatches.length.toLocaleString()} matching word${allMatches.length === 1 ? '' : 's'} found for "${label}".</div>`;
        suggestionsContainer.innerHTML = countText + matches
            .map((word) => `<button class="suggestion-chip" type="button" data-word="${word}">${word}</button>`)
            .join('');

        suggestionsContainer.querySelectorAll('.suggestion-chip').forEach((button) => {
            button.addEventListener('click', () => {
                const word = button.getAttribute('data-word');
                copyToClipboard(word);
                button.textContent = 'Copied!';
                button.disabled = true;
                setTimeout(() => {
                    button.textContent = word;
                    button.disabled = false;
                }, 900);
            });
        });
    }

    let wordList = [];

    loadWordList()
        .then((words) => {
            wordList = words;
            renderSuggestions('', wordList);
        })
        .catch((error) => {
            console.error('Could not load word list:', error);
            suggestionsContainer.innerHTML = '<div class="empty-state">The word list could not be loaded.</div>';
        });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        renderSuggestions(input.value, wordList);
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            renderSuggestions(input.value, wordList);
        }
    });
});
