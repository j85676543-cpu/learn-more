document.addEventListener('DOMContentLoaded', async () => {
    const todoList = document.querySelector('.todo-list');
    if (!todoList) return;

    const clearAllButton = document.getElementById('clearAllTodos');

    function parseRoles(profile) {
        if (!profile) return [];
        if (Array.isArray(profile.roles)) return profile.roles;
        if (typeof profile.roles === 'string') return [profile.roles];
        if (typeof profile.role === 'string') return [profile.role];
        return [];
    }

    function hasDeveloperRole(profile) {
        const roles = parseRoles(profile).map(role => String(role || '').trim().toLowerCase());
        return roles.includes('developer');
    }

    const isDeveloper = false;

    if (clearAllButton && isDeveloper) {
        clearAllButton.style.display = 'inline-flex';
        clearAllButton.addEventListener('click', () => {
            todoList.innerHTML = '';
        });
    }

    todoList.addEventListener('click', (event) => {
        const todoItem = event.target.closest('.todo-item');
        if (!todoItem) return;
        todoItem.classList.toggle('todo-item-done');
    });
});
