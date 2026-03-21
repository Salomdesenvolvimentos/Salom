// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const scrollTopBtn = document.getElementById('scrollTop');
const quoteForm = document.getElementById('quoteForm');
const navbar = document.querySelector('.navbar');

// ========================================
// MENU RESPONSIVO
// ========================================
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
});

// Fechar menu ao clicar em um link
navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// ========================================
// NAVBAR AO SCROLL
// ========================================
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    // Adicionar classe quando rolar
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// ========================================
// BOTÃO VOLTAR AO TOPO
// ========================================
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 500) {
        scrollTopBtn.classList.add('visible');
    } else {
        scrollTopBtn.classList.remove('visible');
    }
});

scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ========================================
// ANIMAÇÕES DE SCROLL
// ========================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observar elementos para animação
document.addEventListener('DOMContentLoaded', () => {
    const elementsToAnimate = [
        '.service-card',
        '.differential-item',
        '.portfolio-item',
        '.step',
        '.testimonial-card',
        '.about-content',
        '.quote-wrapper'
    ];
    
    elementsToAnimate.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.classList.add('fade-in');
            observer.observe(el);
        });
    });
});

// ========================================
// PARTÍCULAS NO HERO
// ========================================
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = window.innerWidth > 768 ? 50 : 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        // Posição aleatória
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        
        // Atraso de animação aleatório
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        
        particlesContainer.appendChild(particle);
    }
}

createParticles();

// Recriar partículas ao redimensionar
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const particlesContainer = document.getElementById('particles');
        if (particlesContainer) {
            particlesContainer.innerHTML = '';
            createParticles();
        }
    }, 250);
});

// ========================================
// VALIDAÇÃO E ENVIO DO FORMULÁRIO
// ========================================
if (quoteForm) {
    quoteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Capturar dados do formulário
        const formData = {
            nome: document.getElementById('nome').value,
            empresa: document.getElementById('empresa').value,
            whatsapp: document.getElementById('whatsapp').value,
            email: document.getElementById('email').value,
            tipo: document.getElementById('tipo').value,
            descricao: document.getElementById('descricao').value
        };
        
        // Validação básica
        if (!formData.nome || !formData.whatsapp || !formData.email || !formData.tipo || !formData.descricao) {
            showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }
        
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showNotification('Por favor, insira um email válido.', 'error');
            return;
        }
        
        // Simular envio (aqui você pode integrar com backend)
        showNotification('Enviando sua solicitação...', 'info');
        
        setTimeout(() => {
            showNotification('Solicitação enviada com sucesso! Entraremos em contato em breve.', 'success');
            quoteForm.reset();
            
            // Opcional: Redirecionar para WhatsApp
            const whatsappNumber = '5511913240090'; // Substitua pelo número real
            const message = `Olá! Gostaria de solicitar um orçamento para: ${formData.tipo}\n\nNome: ${formData.nome}\nEmail: ${formData.email}\n\nDescrição: ${formData.descricao}`;
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            
            // Descomentar para abrir WhatsApp automaticamente
            // window.open(whatsappUrl, '_blank');
        }, 1500);
    });
}

// ========================================
// SISTEMA DE NOTIFICAÇÕES
// ========================================
function showNotification(message, type = 'info') {
    // Remover notificação existente
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Criar notificação
    const notification = document.createElement('div');
    notification.classList.add('notification', `notification-${type}`);
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Adicionar estilos inline
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 20px 25px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Remover após 5 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle'
    };
    return icons[type] || 'info-circle';
}

function getNotificationColor(type) {
    const colors = {
        success: 'linear-gradient(135deg, #00ff88, #00cc6e)',
        error: 'linear-gradient(135deg, #ff4444, #cc0000)',
        info: 'linear-gradient(135deg, #00d9ff, #0099cc)',
        warning: 'linear-gradient(135deg, #ffaa00, #ff8800)'
    };
    return colors[type] || colors.info;
}

// Adicionar estilos de animação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    
    .notification-content i {
        font-size: 24px;
    }
`;
document.head.appendChild(style);

// ========================================
// MÁSCARA DE TELEFONE
// ========================================
const whatsappInput = document.getElementById('whatsapp');
if (whatsappInput) {
    whatsappInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 11) {
            value = value.slice(0, 11);
        }
        
        if (value.length > 10) {
            value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
        } else if (value.length > 6) {
            value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
        } else if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
        } else {
            value = value.replace(/^(\d*)/, '($1');
        }
        
        e.target.value = value;
    });
}

// ========================================
// SMOOTH SCROLL PARA LINKS INTERNOS
// ========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const offsetTop = target.offsetTop - 80; // 80px = altura do navbar
            
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ========================================
// CONTADOR ANIMADO NAS ESTATÍSTICAS
// ========================================
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            element.textContent = target + (element.dataset.suffix || '');
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start) + (element.dataset.suffix || '');
        }
    }, 16);
}

// Observar estatísticas para animar quando visíveis
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
            const target = parseInt(entry.target.dataset.target);
            animateCounter(entry.target, target);
            entry.target.classList.add('animated');
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-item h3').forEach((stat, index) => {
    const values = [50, 98, 5];
    const suffixes = ['+', '%', '+'];
    
    stat.dataset.target = values[index];
    stat.dataset.suffix = suffixes[index];
    statsObserver.observe(stat);
});

// ========================================
// EFEITO PARALLAX SUAVE NO HERO
// ========================================
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroContent = document.querySelector('.hero-content');
    const gridLines = document.querySelector('.grid-lines');
    
    if (heroContent) {
        heroContent.style.transform = `translateY(${scrolled * 0.3}px)`;
        heroContent.style.opacity = 1 - scrolled / 700;
    }
    
    if (gridLines) {
        gridLines.style.opacity = 1 - scrolled / 500;
    }
});

// ========================================
// DESTACAR LINK ATIVO NA NAVEGAÇÃO
// ========================================
function highlightActiveSection() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.pageYOffset + 150;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            document.querySelectorAll('.nav-menu a').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', highlightActiveSection);

// ========================================
// PRELOADER (OPCIONAL)
// ========================================
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    
    // Aplicar animações iniciais
    setTimeout(() => {
        const heroElements = document.querySelectorAll('.hero-content > *');
        heroElements.forEach((el, index) => {
            setTimeout(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 100);
});

// ========================================
// LAZY LOADING PARA IMAGENS
// ========================================
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src || img.src;
                img.classList.add('loaded');
                imageObserver.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// ========================================
// PROTEÇÃO CONTRA SPAM NO FORMULÁRIO
// ========================================
let lastSubmitTime = 0;
const submitCooldown = 5000; // 5 segundos

if (quoteForm) {
    quoteForm.addEventListener('submit', (e) => {
        const now = Date.now();
        if (now - lastSubmitTime < submitCooldown) {
            e.preventDefault();
            const remainingTime = Math.ceil((submitCooldown - (now - lastSubmitTime)) / 1000);
            showNotification(`Por favor, aguarde ${remainingTime} segundos antes de enviar novamente.`, 'warning');
            return;
        }
        lastSubmitTime = now;
    });
}

// ========================================
// LOG DE INICIALIZAÇÃO
// ========================================
console.log('%c🚀 Salom Website Loaded Successfully!', 'color: #00ff88; font-size: 16px; font-weight: bold;');
console.log('%cDesenvolvemos seu sistema de forma segura e com suporte que você merece.', 'color: #00d9ff; font-size: 12px;');
