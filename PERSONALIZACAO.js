/* =====================================================
   GUIA RÁPIDO DE PERSONALIZAÇÃO
   ===================================================== */

/* 
   Este arquivo contém as principais personalizações
   que você pode querer fazer no site da Salom.
*/

// =====================================================
// 1. ALTERAR CORES DO SITE
// =====================================================

/*
   Abra o arquivo: styles.css
   Procure por: :root {
   Altere estas variáveis:
*/

--primary-color: #00ff88;        // Cor principal (verde)
--secondary-color: #00d9ff;      // Cor secundária (azul)
--bg-dark: #0a0e27;             // Fundo principal
--bg-darker: #050811;            // Fundo mais escuro
--bg-card: #131829;             // Fundo dos cards

// =====================================================
// 2. ALTERAR INFORMAÇÕES DE CONTATO
// =====================================================

// No arquivo index.html, busque e substitua:

Email: contato@salom.com.br → seuemail@empresa.com.br
Telefone: (11) 91324-0090 → seu telefone
Endereço: São Paulo, SP → sua cidade

// =====================================================
// 3. CONFIGURAR WHATSAPP
// =====================================================

// No arquivo script.js, linha ~115:
const whatsappNumber = '5511913240090'; // Altere para seu número

// No arquivo index.html, linha ~660:
<a href="https://wa.me/5511913240090..." // Altere o número

// Formato: código do país (55) + DDD + número
// Exemplo: 5511913240090 = +55 (11) 91324-0090

// =====================================================
// 4. ADICIONAR SUAS PRÓPRIAS IMAGENS
// =====================================================

/*
   Opção 1: Criar pasta de imagens
   1. Crie uma pasta chamada "images" na raiz do projeto
   2. Coloque suas imagens lá
   3. No index.html, substitua os URLs do Unsplash por:
      src="images/nome-da-imagem.jpg"
*/

// Seção Portfólio (linha 305):
<img src="images/projeto1.jpg" alt="Projeto 1">
<img src="images/projeto2.jpg" alt="Projeto 2">

// Seção Sobre (linha 595):
<img src="images/equipe.jpg" alt="Equipe Salom">

// =====================================================
// 5. PERSONALIZAR PROJETOS DO PORTFÓLIO
// =====================================================

// No arquivo index.html, procure por "portfolio-item"
// Estrutura de cada projeto:

<div class="portfolio-item">
    <div class="portfolio-image">
        <img src="SUA_IMAGEM.jpg" alt="Nome do Projeto">
        <div class="portfolio-overlay">
            <h3>Nome do Projeto</h3>
            <p>Descrição breve do projeto</p>
            <div class="portfolio-tech">
                <span>Tecnologia 1</span>
                <span>Tecnologia 2</span>
            </div>
            <a href="#" class="btn-portfolio">Ver Detalhes</a>
        </div>
    </div>
</div>

// =====================================================
// 6. MODIFICAR ESTATÍSTICAS (50+, 98%, 5+)
// =====================================================

// No arquivo index.html, linha 73-83:
<div class="stat-item">
    <h3>50+</h3>                    // Altere o número
    <p>Projetos Concluídos</p>      // Altere o texto
</div>

// No arquivo script.js, linha 301-303:
const values = [50, 98, 5];         // Altere os números
const suffixes = ['+', '%', '+'];   // Altere os sufixos

// =====================================================
// 7. PERSONALIZAR DEPOIMENTOS
// =====================================================

// No arquivo index.html, procure por "testimonial-card"
// Estrutura de cada depoimento:

<div class="testimonial-card">
    <div class="testimonial-rating">
        <!-- 5 estrelas = 5 ícones -->
        <i class="fas fa-star"></i>
    </div>
    <p class="testimonial-text">
        "Texto do depoimento aqui..."
    </p>
    <div class="testimonial-author">
        <div class="author-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="author-info">
            <h4>Nome do Cliente</h4>
            <p>Cargo - Empresa</p>
        </div>
    </div>
</div>

// =====================================================
// 8. MODIFICAR SERVIÇOS
// =====================================================

// No arquivo index.html, procure por "service-card"
// Cada serviço tem:

<div class="service-card">
    <div class="service-icon">
        <i class="fas fa-globe"></i>     // Ícone do serviço
    </div>
    <h3>Nome do Serviço</h3>
    <p>Descrição do serviço...</p>
    <ul class="service-features">
        <li><i class="fas fa-check"></i> Feature 1</li>
        <li><i class="fas fa-check"></i> Feature 2</li>
    </ul>
</div>

// Para ícones diferentes, visite: fontawesome.com/icons

// =====================================================
// 9. CONFIGURAR ENVIO DO FORMULÁRIO
// =====================================================

/*
   Opção 1: Formspree (Gratuito)
   1. Acesse formspree.io
   2. Crie uma conta
   3. No index.html, adicione ao <form>:
*/

<form action="https://formspree.io/f/SEU_ID" method="POST">

/*
   Opção 2: EmailJS
   1. Acesse emailjs.com
   2. Configure seu serviço
   3. Adicione o script no HTML
   4. Configure no script.js
*/

// =====================================================
// 10. ALTERAR REDES SOCIAIS
// =====================================================

// No arquivo index.html, linha 640-645 (rodapé):

<div class="social-links">
    <a href="https://facebook.com/suapagina">Facebook</a>
    <a href="https://instagram.com/seuperfil">Instagram</a>
    <a href="https://linkedin.com/company/suaempresa">LinkedIn</a>
    <a href="https://github.com/seuusuario">GitHub</a>
</div>

// =====================================================
// 11. MODIFICAR TEXTOS PRINCIPAIS
// =====================================================

// SLOGAN (linha 40):
"Desenvolvemos seu sistema de forma segura e com suporte que você merece."

// TÍTULO HERO (linha 52):
"Desenvolvemos seu sistema de forma segura e com suporte que você merece."

// SUBTÍTULO HERO (linha 55):
"Criamos sistemas, aplicativos e sites sob medida..."

// =====================================================
// 12. AJUSTAR ANIMAÇÕES
// =====================================================

// No arquivo styles.css, procure por:
--transition: all 0.3s ease;  // Velocidade das animações (0.3s)

// Para animações mais rápidas: 0.2s
// Para animações mais lentas: 0.5s

// =====================================================
// 13. ADICIONAR GOOGLE ANALYTICS
// =====================================================

// No arquivo index.html, antes de </head> adicione:

<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=SEU-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'SEU-ID');
</script>

// =====================================================
// 14. PERSONALIZAR FAVICON
// =====================================================

// 1. Crie um favicon (16x16 ou 32x32) com seu logo
// 2. Salve como "favicon.ico" na raiz do projeto
// 3. No index.html, dentro de <head> adicione:

<link rel="icon" type="image/x-icon" href="favicon.ico">

// =====================================================
// 15. ADICIONAR CERTIFICADO SSL (HTTPS)
// =====================================================

/*
   Para sites em produção, use:
   - Let's Encrypt (gratuito)
   - Cloudflare (gratuito)
   - Certificado do seu hosting
   
   Netlify e Vercel já incluem SSL automático!
*/

// =====================================================
// DICAS IMPORTANTES
// =====================================================

/*
   ✅ Sempre faça backup antes de editar
   ✅ Teste em diferentes navegadores
   ✅ Teste em celular e desktop
   ✅ Otimize suas imagens antes de usar
   ✅ Use formatos modernos (WebP para imagens)
   ✅ Mantenha o código organizado
   ✅ Comente suas alterações personalizadas
*/

// =====================================================
// SUPORTE
// =====================================================

/*
   Precisa de ajuda? Entre em contato:
    📧 Email: contato@salom.com.br
    📱 WhatsApp: (11) 91324-0090
*/
