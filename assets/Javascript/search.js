// Search functionality - Simplified for floating button
// The floating search button is a simple link to the search page
// No JavaScript needed for basic navigation

// Optional: Add keyboard shortcut for quick access
document.addEventListener('DOMContentLoaded', function () {
    // Keyboard shortcut: Ctrl/Cmd + K to navigate to search page
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            window.location.href = './pages/search.html';
        }
    });
});
