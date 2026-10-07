/**
 * Onboardinho — versão DEMONSTRAÇÃO para Google Apps Script.
 *
 * Como publicar:
 * 1. script.google.com → Novo projeto.
 * 2. Cole este código em Code.gs.
 * 3. Arquivo → Novo → HTML, nome "Index" (sem .html), e cole o Index.html.
 * 4. Implantar → Nova implantação → Tipo: App da Web.
 *    Executar como: você. Quem pode acessar: só pessoas da sua organização.
 * 5. Abra o link /exec que aparecer.
 *
 * Os dados são de exemplo e ficam no próprio HTML: nada é salvo.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Onboardinho')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
