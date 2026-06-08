function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerHTML.toLowerCase().includes(sectionId.toLowerCase())) {
            item.classList.add('active');
        }
    });
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
    }
}
