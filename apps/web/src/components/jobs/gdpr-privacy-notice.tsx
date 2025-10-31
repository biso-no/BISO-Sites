"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'

interface GDPRPrivacyNoticeProps {
  locale: 'en' | 'no'
}

export function GDPRPrivacyNotice({ locale }: GDPRPrivacyNoticeProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="text-base">
          {locale === 'no' ? '🔒 Personvern og databehandling' : '🔒 Privacy and Data Processing'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {locale === 'no' ? (
          <>
            <p>
              <strong>Behandlingsansvarlig:</strong> BISO (Business and IT Student Organization)
            </p>
            <p>
              <strong>Formål:</strong> Vi behandler dine personopplysninger for å evaluere din jobbsøknad og gjennomføre rekrutteringsprosessen.
            </p>
            <p>
              <strong>Rettslig grunnlag:</strong> Samtykke (GDPR Art. 6(1)(a)) og berettiget interesse for rekrutteringsformål.
            </p>
            <p>
              <strong>Oppbevaring:</strong> Dine data oppbevares i 2 år fra søknadsdato, deretter slettes de automatisk.
            </p>
            <p>
              <strong>Dine rettigheter:</strong> Du har rett til innsyn, retting, sletting, begrensning av behandling, dataportabilitet og å trekke tilbake samtykke.
            </p>
            <p>
              <strong>Kontakt:</strong> For spørsmål om personvern, kontakt oss på{' '}
              <a href="mailto:privacy@biso.no" className="underline">privacy@biso.no</a>
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>Data Controller:</strong> BISO (Business and IT Student Organization)
            </p>
            <p>
              <strong>Purpose:</strong> We process your personal data to evaluate your job application and conduct the recruitment process.
            </p>
            <p>
              <strong>Legal Basis:</strong> Consent (GDPR Art. 6(1)(a)) and legitimate interest for recruitment purposes.
            </p>
            <p>
              <strong>Retention:</strong> Your data is stored for 2 years from the application date, after which it is automatically deleted.
            </p>
            <p>
              <strong>Your Rights:</strong> You have the right to access, rectification, erasure, restriction of processing, data portability, and to withdraw consent.
            </p>
            <p>
              <strong>Contact:</strong> For privacy questions, contact us at{' '}
              <a href="mailto:privacy@biso.no" className="underline">privacy@biso.no</a>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
