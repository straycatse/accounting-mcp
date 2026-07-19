export const metadata = { title: "Terms of service — accounting-mcp" };

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Terms of service</h1>
      <p className="text-muted-foreground">accounting-mcp is operated by Stray Cat AB, Sweden.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          The service lets you connect your own accounting software (currently Bokio) to AI
          assistants via the Model Context Protocol. You act on your own accounting data, on your
          own instruction, under your own Bokio agreement.
        </li>
        <li>
          After a free trial, continued use requires a paid subscription (price shown at checkout,
          per connected company, excl. VAT). You can cancel any time; access remains until the end
          of the paid period.
        </li>
        <li>
          The service is provided as-is. Always review AI-initiated bookkeeping changes; you are
          responsible for the correctness of your accounts.
        </li>
        <li>
          Support:{" "}
          <a href="mailto:simon@straycat.se" className="underline underline-offset-4">
            simon@straycat.se
          </a>
        </li>
      </ul>
      <p className="text-muted-foreground">
        <em>Svenska:</em> Tjänsten drivs av Stray Cat AB. Efter en gratis provperiod krävs
        prenumeration (pris per anslutet företag, exkl. moms). Du ansvarar själv för din bokföring
        — granska alltid ändringar som görs via AI.
      </p>
    </>
  );
}
