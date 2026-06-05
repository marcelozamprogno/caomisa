# Caomisa Shop - Cloned Website

Este diretório contém o clone completo do site **caomisa.shop**, incluindo todo o front-end (HTML, CSS, JavaScript, Fontes e Imagens de produtos) e o banco de dados local com as APIs de produtos, coleções, banners e conteúdo institucional.

## Estrutura do Projeto

* `index.html` - Página principal do site.
* `styles.css` - Folha de estilos completa do site.
* `script.js` - Lógica front-end (carrossel, carrinho de compras, pesquisa, roteamento SPA).
* `assets/` - Pasta contendo imagens de produtos, logotipos, fontes e ícones baixados.
* `api_products.json`, `api_banners.json`, `api_site_content.json`, `api_collections.json` - Dados das APIs do site original salvos localmente.
* `run_server.ps1` - Servidor web local nativo para PowerShell (não precisa de Node ou Python instalados).
* `server.js` - Servidor Node.js Express opcional.
* `server.py` - Servidor Python opcional.

---

## Como Rodar Localmente (3 Opções)

Escolha **uma** das opções abaixo para iniciar o site localmente:

### Opção 1: Usando PowerShell (Recomendado para Windows sem dependências)

Se você não possui Node.js ou Python instalados, pode usar o servidor nativo em PowerShell.

1. Abra o PowerShell no diretório do projeto.
2. Execute o comando:
   ```powershell
   powershell -ExecutionPolicy Bypass -File run_server.ps1
   ```
3. Acesse no seu navegador: [http://localhost:3000/](http://localhost:3000/)

### Opção 2: Usando Node.js (Se tiver o Node instalado)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor:
   ```bash
   npm start
   ```
3. Acesse no seu navegador: [http://localhost:3000/](http://localhost:3000/)

### Opção 3: Usando Python (Se tiver o Python instalado)

1. Inicie o servidor:
   ```bash
   python server.py
   ```
2. Acesse no seu navegador: [http://localhost:3000/](http://localhost:3000/)

---

## Recursos Suportados no Clone Local

* **Pesquisa de Produtos**: O painel de busca no cabeçalho funciona pesquisando os produtos baixados.
* **Filtro de Categorias**: O menu superior filtra dinamicamente a vitrine pelos dados das coleções.
* **Carrinho de Compras**: O fluxo de adicionar itens ao carrinho, alterar quantidades e remover itens é 100% funcional localmente através do `localStorage`.
* **Páginas de Produtos Dinâmicas**: Clicar em qualquer produto abrirá a página de detalhes correspondente com imagens reais, zoom na galeria, seletor de cor e tamanho, além dos depoimentos reais de clientes salvos para cada produto.
* **SPA Routing**: O servidor redireciona as rotas como `/produto/*` de volta ao `index.html`, permitindo que o roteamento de SPA do front-end funcione perfeitamente.
