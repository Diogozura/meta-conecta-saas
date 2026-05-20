import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidade",
  description: "Aviso de Privacidade da plataforma, explicando como tratamos dados pessoais e como exercer seus direitos.",
};

export default function PoliticaDePrivacidade() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-slate-900">
      <div className="space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight">Aviso de Privacidade</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700">
            A Scale Estratégia Digital criou este Aviso de Privacidade (o “Aviso") para explicar como trata dados
            pessoais quando você utiliza nossa plataforma de comunicação via WhatsApp Business API, acessa nosso
            sistema ou entra em contato conosco.
          </p>
          <p className="mt-4 text-slate-700">
            Em caso de dúvida ou para exercer seus direitos como Titular, fale conosco pelos canais informados ao final
            deste documento.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { href: "#sec-1", label: "1. Definições" },
            { href: "#sec-2", label: "2. A quem se aplica este Aviso" },
            { href: "#sec-3", label: "3. Quais dados coletamos e como" },
            { href: "#sec-4", label: "4. Finalidades do tratamento" },
            { href: "#sec-5", label: "5. Bases legais aplicáveis" },
            { href: "#sec-6", label: "6. Com quem compartilhamos seus dados" },
            { href: "#sec-7", label: "7. Por quanto tempo guardamos seus dados" },
            { href: "#sec-8", label: "8. Como protegemos seus dados" },
            { href: "#sec-9", label: "9. Direitos do Titular" },
            { href: "#sec-10", label: "10. Cookies" },
            { href: "#sec-11", label: "11. Transferência internacional de dados" },
            { href: "#sec-12", label: "12. Encarregado e canais de contato" },
            { href: "#sec-13", label: "13. Alterações desta Política" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {item.label}
            </a>
          ))}
        </section>

        <article id="sec-1" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">1. Definições</h2>
          <p className="mt-4 text-slate-700 leading-7">
            Para facilitar a leitura, alguns termos usados neste Aviso:
          </p>
          <ul className="mt-4 space-y-3 pl-5 text-slate-700">
            <li>• <strong>Scale / Nós</strong>. Scale Estratégia Digital, responsável pela plataforma e pelo tratamento dos dados descritos neste Aviso.</li>
            <li>• <strong>Cliente</strong>. Pessoa física ou jurídica que contrata os serviços da Scale e utiliza a plataforma de comunicação via WhatsApp Business API.</li>
            <li>• <strong>Usuário</strong>. Pessoa indicada pelo Cliente para operar a plataforma ou que acessa nosso sistema.</li>
            <li>• <strong>Titular</strong>. Pessoa natural a quem se referem os dados pessoais.</li>
            <li>• <strong>Controlador / Operador</strong>. Conceitos da LGPD: o Controlador toma as decisões sobre o tratamento; o Operador trata os dados segundo as instruções do Controlador.</li>
            <li>• <strong>LGPD</strong>. Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais.</li>
            <li>• <strong>ANPD</strong>. Autoridade Nacional de Proteção de Dados.</li>
            <li>• <strong>Plataforma WhatsApp / Meta</strong>. Serviços operados pela WhatsApp LLC (Meta Platforms, Inc.), integrados à nossa plataforma via API Oficial.</li>
            <li>• <strong>Tratamento</strong>. Qualquer operação realizada com dados pessoais (coleta, armazenamento, transmissão, eliminação etc.), nos termos do art. 5º, X, da LGPD.</li>
          </ul>
        </article>

        <article id="sec-2" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">2. A quem se aplica este Aviso</h2>
          <div className="mt-4 space-y-4 text-slate-700 leading-7">
            <p>Este Aviso se aplica aos seguintes Titulares:</p>
            <ul className="pl-5 space-y-2">
              <li>• Visitantes do nosso site e leads que preenchem formulários de contato;</li>
              <li>• Clientes que contratam os serviços da Scale;</li>
              <li>• Usuários indicados pelos Clientes para operar a plataforma.</li>
            </ul>
            <p>
              Este Aviso não se aplica diretamente aos contatos finais (leads, clientes do Cliente) cujos dados o Cliente trafega pela plataforma.
              Em relação a esses dados, o Cliente atua como Controlador e é responsável por manter sua própria política de privacidade, obter os consentimentos necessários e atender às solicitações dos titulares.
            </p>
          </div>
        </article>

        <article id="sec-3" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">3. Quais dados coletamos e como</h2>
          <div className="mt-5 space-y-6 text-slate-700 leading-7">
            <div>
              <h3 className="text-2xl font-semibold">3.1. Dados que você nos fornece diretamente</h3>
              <p className="mt-3">
                Quando você se cadastra na plataforma, preenche formulários ou entra em contato conosco, coletamos:
              </p>
              <ul className="mt-3 pl-5 space-y-2">
                <li>• Identificação e contato: nome, e-mail, telefone e CPF/CNPJ para faturamento e validação do cadastro.</li>
                <li>• Credenciais de acesso: senha (armazenada em hash) e registros de aceite dos Termos de Uso e deste Aviso.</li>
                <li>• Mensagens espontâneas: conteúdo de mensagens enviadas para suporte ou atendimento, armazenado para histórico e resposta.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-semibold">3.2. Dados coletados automaticamente</h3>
              <p className="mt-3">
                Durante o uso da plataforma e navegação no nosso site, registramos automaticamente:
              </p>
              <ul className="mt-3 pl-5 space-y-2">
                <li>• Logs de acesso: endereço IP, data e hora das ações, dispositivo e navegador.</li>
                <li>• Cookies: detalhes sobre os cookies utilizados estão descritos no capítulo 10 deste Aviso.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-semibold">3.3. Dados técnicos da integração com a Meta</h3>
              <p className="mt-3">
                Para operar a integração com a WhatsApp Business API, tratamos dados técnicos fornecidos pela Meta, incluindo:
              </p>
              <ul className="mt-3 pl-5 space-y-2">
                <li>• App ID, WABA ID e tokens de acesso OAuth;</li>
                <li>• Eventos de webhook e status de conexão;</li>
                <li>• Identificadores de número de telefone registrado;</li>
                <li>• Indicadores de qualidade fornecidos pela própria Meta.</li>
              </ul>
              <p className="mt-3">
                Esses dados são tratados exclusivamente para execução do serviço, segurança operacional e cumprimento dos requisitos da plataforma Meta.
              </p>
            </div>
          </div>
        </article>

        <article id="sec-4" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">4. Finalidades do tratamento</h2>
          <div className="mt-4 leading-7 text-slate-700">
            <p>Tratamos os dados acima exclusivamente para as finalidades abaixo. Qualquer tratamento para finalidade não prevista dependerá de nova base legal ou novo consentimento.</p>
            <ul className="mt-4 pl-5 space-y-2">
              <li>• Operação do contrato: identificar Cliente e Usuário, faturar, validar o acesso, prestar suporte técnico e comunicar aspectos contratuais.</li>
              <li>• Comunicação e marketing: responder dúvidas, enviar novidades e comunicados sobre a plataforma — sempre com possibilidade de descadastro (opt-out).</li>
              <li>• Segurança e prevenção a fraudes: identificar tentativas de abuso e proteger a integridade da plataforma.</li>
              <li>• Cumprimento de obrigações legais: atender ordens judiciais, requisições da ANPD e demais obrigações legais.</li>
              <li>• Exercício regular de direitos: defesa em processos judiciais, administrativos ou arbitrais.</li>
              <li>• Melhoria da plataforma: analisar uso, desempenho e experiência do usuário para aprimoramento contínuo do serviço.</li>
            </ul>
          </div>
        </article>

        <article id="sec-5" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">5. Bases legais aplicáveis</h2>
          <div className="mt-4 leading-7 text-slate-700">
            <p>Cada atividade de tratamento encontra base legal na LGPD, conforme descrito abaixo:</p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Atividade</th>
                    <th className="px-4 py-3 text-left font-semibold">Base legal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-3">Execução do contrato e suporte</td>
                    <td className="px-4 py-3">Art. 7º, V — execução de contrato</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Faturamento e cadastro</td>
                    <td className="px-4 py-3">Art. 7º, V — execução de contrato</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Comunicações de marketing</td>
                    <td className="px-4 py-3">Art. 7º, I — consentimento</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Segurança e prevenção a fraudes</td>
                    <td className="px-4 py-3">Art. 7º, IX — legítimo interesse</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Obrigações legais</td>
                    <td className="px-4 py-3">Art. 7º, II — obrigação legal</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Defesa em processos</td>
                    <td className="px-4 py-3">Art. 7º, VI — exercício regular de direitos</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Melhoria da plataforma</td>
                    <td className="px-4 py-3">Art. 7º, IX — legítimo interesse</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Você pode revogar consentimentos a qualquer tempo pelos canais informados no capítulo 12 deste Aviso.
            </p>
          </div>
        </article>

        <article id="sec-6" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">6. Com quem compartilhamos seus dados</h2>
          <div className="mt-4 space-y-5 text-slate-700 leading-7">
            <div>
              <h3 className="text-2xl font-semibold">6.1. Operadores</h3>
              <p className="mt-3">
                Terceiros que tratam dados sob nossas instruções, com contratos de tratamento e padrões mínimos de segurança compatíveis com a LGPD:
              </p>
              <ul className="mt-3 pl-5 space-y-2">
                <li>• Infraestrutura de hospedagem. Provedores de nuvem responsáveis por armazenar e processar dados da plataforma.</li>
                <li>• Plataforma de e-mail transacional. Envio de notificações, confirmações de cadastro e comunicações do sistema.</li>
                <li>• Suíte de produtividade corporativa. Ferramentas internas de comunicação e gestão operacional.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-semibold">6.2. Controladores parceiros</h3>
              <p className="mt-3">
                Terceiros que tratam dados com finalidades próprias, de forma autônoma:
              </p>
              <ul className="mt-3 pl-5 space-y-2">
                <li>• Meta Platforms, Inc. / WhatsApp LLC. Provedora da API oficial do WhatsApp Business Platform. A Scale opera como parceira integrada dessa API, e a relação com a Meta é regida pelos termos da plataforma.</li>
                <li>• Plataformas de pagamento. Processam dados de faturamento conforme suas próprias políticas de privacidade.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-semibold">6.3. Integrações configuradas pelo Cliente</h3>
              <p className="mt-3">
                O Cliente pode configurar integrações com outros canais e sistemas (CRMs, portais imobiliários, etc.). Os dados que trafegam por essas integrações são governados pelos termos das respectivas plataformas, sobre as quais a Scale não tem responsabilidade.
              </p>
            </div>
            <p className="text-slate-700">
              A Scale compartilha dados pessoais apenas com terceiros indispensáveis à operação da plataforma e à prestação dos serviços.
            </p>
          </div>
        </article>

        <article id="sec-7" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">7. Por quanto tempo guardamos seus dados</h2>
          <div className="mt-4 space-y-4 text-slate-700 leading-7">
            <ul className="pl-5 space-y-2">
              <li>• Cadastro ativo. Enquanto o Cliente mantiver contrato ativo, os dados cadastrais são tratados para execução do serviço.</li>
              <li>• Após o encerramento. Os dados podem ser conservados por até 5 (cinco) anos após o término da relação, com base em legítimo interesse, para defesa em eventuais processos (arts. 7º, IX, e 16, II, LGPD).</li>
              <li>• Logs de acesso. Mantidos por, no mínimo, 6 (seis) meses, em cumprimento ao art. 15 da Lei nº 12.965/2014 (Marco Civil da Internet).</li>
              <li>• Obrigações legais específicas. Documentos fiscais e demais dados sujeitos a prazos de guarda definidos em lei são conservados pelo prazo correspondente.</li>
            </ul>
            <p>A solicitação de exclusão pode ser feita a qualquer momento pelo e-mail <a className="font-semibold text-slate-900" href="mailto:privacidade@scaleestrategiadigital.com.br">privacidade@scaleestrategiadigital.com.br</a>. Após o atendimento, os dados são deletados permanentemente, ressalvadas as hipóteses legais de conservação.</p>
          </div>
        </article>

        <article id="sec-8" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">8. Como protegemos seus dados</h2>
          <div className="mt-4 space-y-4 text-slate-700 leading-7">
            <p>A Scale adota medidas técnicas e organizacionais para proteger os dados pessoais sob sua responsabilidade contra acessos não autorizados, perda, destruição e uso indevido. Entre as medidas:</p>
            <ul className="mt-3 pl-5 space-y-2">
              <li>• Controle de acesso baseado em funções;</li>
              <li>• Autenticação segura nos sistemas internos;</li>
              <li>• Criptografia em trânsito (TLS/HTTPS);</li>
              <li>• Gestão segura de credenciais;</li>
              <li>• Monitoramento de eventos de segurança;</li>
              <li>• Contratos de tratamento com todos os Operadores.</li>
            </ul>
            <p>Nenhuma operação realizada via internet é 100% segura. Caso identifique vulnerabilidade ou suspeita de incidente envolvendo nossos sistemas, entre em contato imediato pelo e-mail <a className="font-semibold text-slate-900" href="mailto:privacidade@scaleestrategiadigital.com.br">privacidade@scaleestrategiadigital.com.br</a>.</p>
          </div>
        </article>

        <article id="sec-9" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">9. Direitos do Titular</h2>
          <div className="mt-4 space-y-4 text-slate-700 leading-7">
            <p>A LGPD assegura a você, na qualidade de Titular, os direitos abaixo, que podem ser exercidos pelo e-mail <a className="font-semibold text-slate-900" href="mailto:privacidade@scaleestrategiadigital.com.br">privacidade@scaleestrategiadigital.com.br</a>:</p>
            <ul className="mt-4 pl-5 space-y-2">
              <li>• Confirmação e acesso ao tratamento de seus dados;</li>
              <li>• Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>• Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
              <li>• Portabilidade dos dados a outro fornecedor, observados o segredo comercial e industrial;</li>
              <li>• Eliminação dos dados tratados com consentimento, ressalvadas as hipóteses legais de conservação;</li>
              <li>• Informação sobre as entidades com as quais a Scale compartilha seus dados;</li>
              <li>• Revogação de consentimento a qualquer tempo, gratuitamente;</li>
              <li>• Oposição ao tratamento realizado com base em legítimo interesse;</li>
              <li>• Revisão de decisões automatizadas que afetem seus interesses;</li>
              <li>• Reclamação perante a ANPD ou demais órgãos competentes.</li>
            </ul>
            <p>Para garantir que os direitos sejam exercidos pelo Titular ou seu representante legal, a Scale pode solicitar informações ou comprovações de identidade. Atenderemos às solicitações dentro dos prazos previstos pela LGPD.</p>
          </div>
        </article>

        <article id="sec-10" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">10. Cookies</h2>
          <div className="mt-4 text-slate-700 leading-7">
            <p>Nossa plataforma utiliza cookies para garantir o funcionamento técnico, medir audiência e melhorar a experiência de uso. Os cookies utilizados são de duas naturezas:</p>
            <ul className="mt-4 pl-5 space-y-2">
              <li>• Cookies estritamente necessários. Indispensáveis ao funcionamento e à segurança da plataforma. Não dependem de consentimento, com base em legítimo interesse e obrigação legal (art. 7º, II e IX, LGPD).</li>
              <li>• Cookies opcionais (estatísticos, de performance e funcionais). Ativados somente mediante o seu consentimento. Você pode aceitar, rejeitar ou alterar sua escolha a qualquer momento. A rejeição não compromete o funcionamento básico da plataforma.</li>
            </ul>
          </div>
        </article>

        <article id="sec-11" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">11. Transferência internacional de dados</h2>
          <div className="mt-4 text-slate-700 leading-7">
            <p>Para entregar nossos serviços e operar a infraestrutura, podemos transferir dados pessoais para fora do Brasil. As transferências observam o art. 33 da LGPD e são protegidas por cláusulas-padrão contratuais, decisões de adequação do país de destino ou outras salvaguardas previstas em lei.</p>
            <p className="mt-4">As principais regiões de destino incluem:</p>
            <ul className="mt-3 pl-5 space-y-2">
              <li>• Brasil — provedores nacionais utilizados na operação corporativa;</li>
              <li>• União Europeia — provedores de infraestrutura sob regime do GDPR;</li>
              <li>• Estados Unidos e outras regiões — Meta Platforms e demais ferramentas de operação e mensuração.</li>
            </ul>
          </div>
        </article>

        <article id="sec-12" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">12. Encarregado e canais de contato</h2>
          <div className="mt-4 text-slate-700 leading-7">
            <p>Em cumprimento ao art. 41 da LGPD, a Scale mantém responsável pela Proteção de Dados Pessoais designado internamente, que pode ser contatado pelos canais abaixo:</p>
            <ul className="mt-4 pl-5 space-y-2">
              <li>• E-mail para privacidade, LGPD e exercício de direitos: <a className="font-semibold text-slate-900" href="mailto:privacidade@scaleestrategiadigital.com.br">privacidade@scaleestrategiadigital.com.br</a></li>
              <li>• E-mail para comunicação geral e suporte: <a className="font-semibold text-slate-900" href="mailto:contato@scaleestrategiadigital.com.br">contato@scaleestrategiadigital.com.br</a></li>
            </ul>
          </div>
        </article>

        <article id="sec-13" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">13. Alterações desta Política</h2>
          <p className="mt-4 text-slate-700 leading-7">
            Este Aviso pode ser atualizado a qualquer tempo para refletir mudanças na operação, na legislação ou nas práticas de tratamento da Scale. Quando houver alterações relevantes, o Titular será notificado pelos canais cadastrados ou por aviso na plataforma, e a versão atualizada valerá a partir de sua publicação. A continuidade no uso da plataforma após a atualização confirmará a ciência e a vigência do novo Aviso.
          </p>
        </article>

        <footer className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
          <p>© 2026 Scale Estratégia Digital. Todos os direitos reservados.</p>
          <p className="mt-2">Última atualização: 19 de maio de 2026</p>
        </footer>
      </div>
    </main>
  );
}
