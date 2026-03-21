# 🚀 Salom - Website Profissional

Site corporativo moderno e profissional para a **Salom**, empresa de desenvolvimento de software especializada em criação de aplicativos, sistemas web e websites personalizados.

## ✨ Características

### Design
- 🎨 Interface moderna com tema dark (preto, grafite, verde/azul tecnológico)
- ⚡ Efeitos de luz suave e elementos futuristas
- 📱 Totalmente responsivo (mobile-first)
- 🎭 Animações suaves ao rolar a página
- ✨ Partículas animadas na hero section
- 🌟 Efeitos de hover e transições elegantes

### Funcionalidades
- 📊 Contador animado de estatísticas
- 📝 Formulário de orçamento com validação
- 💬 Botão flutuante do WhatsApp
- ⬆️ Botão de voltar ao topo
- 🎯 Navegação com realce da seção ativa
- 📞 Máscara automática para telefone
- 🔔 Sistema de notificações
- 🖼️ Lazy loading para imagens
- 🎨 Efeito parallax suave

### Seções
1. **Hero** - Apresentação impactante com call-to-action
2. **Serviços** - Sites, Aplicativos e Sistemas Personalizados
3. **Diferenciais** - 6 motivos para escolher a Salom
4. **Portfólio** - Galeria de projetos com overlay
5. **Como Funciona** - Processo em 4 etapas
6. **Depoimentos** - Feedback de clientes
7. **Formulário de Orçamento** - Solicitação de projeto
8. **Sobre** - História, missão, visão e valores
9. **Rodapé** - Links, contatos e redes sociais

## 📁 Estrutura do Projeto

```
Salom/
├── index.html      # Estrutura HTML principal
├── styles.css      # Estilos CSS com animações
├── script.js       # Funcionalidades JavaScript
└── README.md       # Documentação
```

## 🚀 Como Usar

1. **Abra o arquivo `index.html` em qualquer navegador moderno**
   - Duplo clique no arquivo
   - Ou arraste para o navegador

2. **Para desenvolvimento local com live reload:**
   ```bash
   # Usando Python
   python -m http.server 8000
   
   # Usando PHP
   php -S localhost:8000
   
   # Usando Node.js (com live-server)
   npx live-server
   ```

3. **Acesse:** `http://localhost:8000`

## ⚙️ Personalização

### Cores
Edite as variáveis CSS em `styles.css`:
```css
:root {
    --primary-color: #00ff88;      /* Verde tecnológico */
    --secondary-color: #00d9ff;    /* Azul tecnológico */
    --bg-dark: #0a0e27;            /* Fundo escuro */
    --bg-darker: #050811;          /* Fundo mais escuro */
}
```

### Informações de Contato
Edite no `index.html`:
- Email: Busque por `contato@salom.com.br`
- Telefone: Busque por `(11) 91324-0090`
- WhatsApp: Busque por `5511913240090`

### Conteúdo
- **Estatísticas**: Edite os números na seção hero
- **Serviços**: Modifique descrições e features
- **Portfólio**: Adicione/remova projetos
- **Depoimentos**: Personalize os feedbacks

## 🎯 Configuração do WhatsApp

No arquivo `script.js`, atualize o número do WhatsApp:
```javascript
const whatsappNumber = '5511913240090'; // Formato: código país + DDD + número
```

No HTML, atualize o link do botão flutuante:
```html
<a href="https://wa.me/5511913240090?text=Olá!..." class="whatsapp-float">
```

## 📧 Configuração do Formulário

O formulário atualmente simula o envio. Para integrar com backend:

1. **Substitua a função de submit em `script.js`**
2. **Opções de integração:**
   - Envio por email (usando serviços como Formspree, EmailJS)
   - API própria
   - Serviços serverless (Netlify Forms, Vercel)

### Exemplo com Formspree:
```html
<form action="https://formspree.io/f/SEU_ID" method="POST">
```

## 🖼️ Imagens

As imagens do portfólio usam Unsplash. Para usar suas próprias imagens:

1. Substitua os URLs das imagens no `index.html`
2. Coloque suas imagens em uma pasta `images/`
3. Atualize os caminhos: `src="images/projeto1.jpg"`

## 🔧 Tecnologias Utilizadas

- **HTML5** - Estrutura semântica
- **CSS3** - Estilos modernos com Grid e Flexbox
- **JavaScript (Vanilla)** - Interatividade
- **Font Awesome 6** - Ícones
- **Unsplash** - Imagens de exemplo

## 📱 Responsividade

O site é totalmente responsivo com breakpoints:
- 📱 Mobile: < 768px
- 📱 Tablet: 768px - 1024px
- 💻 Desktop: > 1024px

## ⚡ Performance

- ✅ CSS e JS minificados (para produção)
- ✅ Lazy loading de imagens
- ✅ Animações otimizadas com CSS
- ✅ Fonts do sistema (Segoe UI)

## 🌐 SEO

Inclui meta tags básicas:
- Description
- Keywords
- Viewport
- Title otimizado

Para melhorar:
- Adicione Open Graph tags
- Implemente Schema.org markup
- Configure sitemap.xml
- Adicione robots.txt

## 🚀 Deploy

### Opções gratuitas:

1. **GitHub Pages**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```
   Ative GitHub Pages nas configurações

2. **Netlify**
   - Arraste a pasta no Netlify.com
   - Deploy instantâneo

3. **Vercel**
   - `vercel --prod`
   - Deploy automático

4. **Firebase Hosting**
   ```bash
   firebase init hosting
   firebase deploy
   ```

## 📝 Checklist de Publicação

- [ ] Atualizar informações de contato
- [ ] Configurar número do WhatsApp
- [ ] Adicionar imagens próprias ao portfólio
- [ ] Configurar formulário com backend real
- [ ] Testar em diferentes navegadores
- [ ] Testar em diferentes dispositivos
- [ ] Otimizar imagens
- [ ] Configurar domínio personalizado
- [ ] Adicionar Google Analytics (opcional)
- [ ] Configurar HTTPS

## 🔒 Segurança

- Validação de formulário no frontend
- Proteção contra spam (cooldown de 5s)
- Sem exposição de dados sensíveis
- HTTPS recomendado em produção

## 📞 Suporte

Para dúvidas ou suporte:
- 📧 Email: contato@salom.com.br
- 📱 WhatsApp: (11) 91324-0090

## 📄 Licença

Este projeto foi desenvolvido para a empresa Salom. Todos os direitos reservados © 2026 Salom.

---

**Desenvolvido com 💚 por Salom**

*Desenvolvemos seu sistema de forma segura e com suporte que você merece.*
