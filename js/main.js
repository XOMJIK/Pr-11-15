document.addEventListener('DOMContentLoaded', () => {

  const header = document.querySelector('header');
  if (header) {
    const burger = document.createElement('button');
    burger.className = 'burger';
    burger.setAttribute('aria-label', 'Меню');
    burger.innerHTML = '<span></span><span></span><span></span>';
    header.appendChild(burger);

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    const mobileNav = document.createElement('div');
    mobileNav.className = 'mobile-nav';
    mobileNav.innerHTML = `
      <button class="mobile-nav-close" aria-label="Закрити">✕</button>
      <div class="mobile-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" placeholder="Пошук товарів..." id="mobileSearchInput">
      </div>
      <a href="index.html"        ${currentPath==='index.html'        ? 'class="active"':''}>Магазин</a>
      <a href="new-arrivals.html" ${currentPath==='new-arrivals.html' ? 'class="active"':''}>Новинки</a>
      <a href="brands.html"       ${currentPath==='brands.html'       ? 'class="active"':''}>Бренди</a>
      <a href="category.html"     ${currentPath==='category.html'     ? 'class="active"':''}>Каталог</a>
      <a href="cart.html"         ${currentPath==='cart.html'         ? 'class="active"':''}>Кошик 🛒</a>
      <a href="login.html"        ${currentPath==='login.html'        ? 'class="active"':''}>Вхід</a>
      <a href="register.html"     ${currentPath==='register.html'     ? 'class="active"':''}>Реєстрація</a>
    `;
    document.body.appendChild(mobileNav);

    function openMenu() {
      mobileNav.classList.add('open');
      burger.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      mobileNav.classList.remove('open');
      burger.classList.remove('open');
      document.body.style.overflow = '';
    }

    burger.addEventListener('click', () => {
      mobileNav.classList.contains('open') ? closeMenu() : openMenu();
    });

    mobileNav.querySelector('.mobile-nav-close').addEventListener('click', closeMenu);

    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
    });

    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) {
      mobileSearchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.value.trim()) {
          window.location.href = 'category.html?search=' + encodeURIComponent(e.target.value.trim());
        }
      });
    }
  }

  window.openTab = function(e, id) {
    const section = e.target.closest('.product-tabs-section, .tabs-section, [data-tabs]') || document;
    section.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    section.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    e.target.classList.add('active');
  };

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('header nav a').forEach(a => {
    const href = a.getAttribute('href')?.split('?')[0];
    if (href === path) a.classList.add('active');
  });

  const updateHeader = () => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const userLinks = document.querySelectorAll(
      '.header-icons a[href="login.html"], .header-icons a[href="profile.html"]'
    );
    if (!userLinks.length) return;

    userLinks.forEach(userIcon => {
      if (user) {
        userIcon.href = 'profile.html';
        userIcon.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--accent)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${user.first_name}
          </div>`;
      } else {
        userIcon.href = 'login.html';
      }
    });

    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav) {
      const loginLink = mobileNav.querySelector('a[href="login.html"]');
      if (loginLink && user) {
        loginLink.href = 'profile.html';
        loginLink.textContent = '👤 ' + user.first_name;
      }
    }
  };

  updateHeader();

  const updateCartCount = () => {
    const token = localStorage.getItem('token');
    const countEl = document.getElementById('cartCount');
    if (!countEl) return;

    if (!token) {
      countEl.textContent = '0';
      return;
    }

    fetch('/api/cart', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(data => {
      countEl.textContent = data.data?.length || 0;
    })
    .catch(() => {
      countEl.textContent = '0';
    });
  };
  updateCartCount();
});