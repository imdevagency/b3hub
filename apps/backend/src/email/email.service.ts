/**
 * Transactional email service (Resend).
 * Sends welcome, password-reset, order confirmation, and quote notification emails.
 * Falls back to console.log when RESEND_API_KEY is absent (dev mode).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly webUrl: string;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from =
      this.config.get<string>('EMAIL_FROM') ?? 'B3Hub <noreply@b3hub.lv>';
    this.webUrl = this.config.get<string>('WEB_URL') ?? 'https://b3hub.lv';
    this.enabled = !!apiKey;

    if (this.enabled) {
      this.resend = new Resend(apiKey);
      this.logger.log('Email service initialised (Resend)');
    } else {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY not set — email sending is DISABLED. Emails will be logged to console only.',
      );
    }
  }

  // ── Public helpers ─────────────────────────────────────────────────────────

  /** Email address verification — sent after registration */
  async sendEmailVerification(to: string, firstName: string, rawToken: string) {
    const verifyUrl = `${this.webUrl}/verify-email?token=${rawToken}`;
    const safeName = this.escape(firstName);
    await this.send({
      to,
      subject: 'Apstipriniet savu e-pasta adresi — B3Hub',
      html: this.base({
        title: 'Apstipriniet savu e-pasta adresi',
        body: `
          <p>Labdien, ${safeName}!</p>
          <p>Paldies, ka reģistrējāties <strong>B3Hub</strong>. Lai pabeigtu reģistrāciju, lūdzu apstipriniet savu e-pasta adresi, noklikšķinot zemāk.</p>
          <p>Saite ir derīga <strong>24 stundas</strong>.</p>
          <p>Ja šo kontu neveidojāt jūs, varat ignorēt šo e-pastu.</p>
        `,
        cta: { label: 'Apstiprināt e-pastu', url: verifyUrl },
        footer: 'Šī saite ir derīga 24 stundas.',
      }),
    });
  }

  /** Welcome email sent immediately after registration */
  async sendWelcome(to: string, firstName: string) {
    const safeName = this.escape(firstName);
    await this.send({
      to,
      subject: 'Laipni lūdzam B3Hub!',
      html: this.base({
        title: `Labdien, ${safeName}!`,
        body: `
          <p>Paldies, ka reģistrējāties <strong>B3Hub</strong> — Latvijas būvmateriālu un transporta platformā.</p>
          <p>Jūs varat pieteikties tūlīt un pārlūkot pieejamos materiālus un pakalpojumus.</p>
        `,
        cta: { label: 'Doties uz platformu', url: `${this.webUrl}/dashboard` },
      }),
    });
  }

  /** Password reset email */
  async sendPasswordReset(to: string, firstName: string, rawToken: string) {
    const safeName = this.escape(firstName);
    const resetUrl = `${this.webUrl}/reset-password?token=${rawToken}`;
    await this.send({
      to,
      subject: 'Paroles atjaunošana — B3Hub',
      html: this.base({
        title: 'Atjaunojiet savu paroli',
        body: `
          <p>Labdien, ${safeName}!</p>
          <p>Saņēmām pieprasījumu atjaunot jūsu konta paroli. Noklikšķiniet zemāk esošo pogu — saite ir derīga <strong>1 stundu</strong>.</p>
          <p>Ja šo pieprasījumu neveicāt jūs, varat ignorēt šo e-pastu.</p>
        `,
        cta: { label: 'Atjaunot paroli', url: resetUrl },
        footer:
          'Šī saite ir derīga vienu stundu. Pēc tās termiņa beigām pieprasiet jaunu atiestatīšanu.',
      }),
    });
  }

  /** Confirmation that the provider application was received */
  async sendApplicationReceived(to: string, firstName: string) {
    const safeName = this.escape(firstName);
    await this.send({
      to,
      subject: 'Pieteikums saņemts — B3Hub',
      html: this.base({
        title: 'Jūsu pieteikums ir saņemts!',
        body: `
          <p>Labdien, ${safeName}!</p>
          <p>Paldies par jūsu pieteikumu kļūt par B3Hub piegādātāju vai pārvadātāju. Mūsu komanda to izskatīs tuvākajā laikā.</p>
          <p>Mēs jūs informēsim pa e-pastu, tiklīdz lēmums būs pieņemts.</p>
        `,
        cta: {
          label: 'Skatīt pieteikuma statusu',
          url: `${this.webUrl}/dashboard`,
        },
      }),
    });
  }

  /** Application was approved by admin */
  async sendApplicationApproved(
    to: string,
    firstName: string,
    capabilities: { canSell: boolean; canTransport: boolean },
  ) {
    const safeName = this.escape(firstName);
    const granted: string[] = [];
    if (capabilities.canSell) granted.push('Pārdevēja piekļuve');
    if (capabilities.canTransport) granted.push('Pārvadātāja piekļuve');

    await this.send({
      to,
      subject: 'Pieteikums apstiprināts — B3Hub 🎉',
      html: this.base({
        title: 'Apsveicam — pieteikums apstiprināts!',
        body: `
          <p>Labdien, ${safeName}!</p>
          <p>Priecājamies informēt, ka jūsu pieteikums ir <strong>apstiprināts</strong>. Jums tika piešķirts:</p>
          <ul style="padding-left:20px;line-height:1.8">
            ${granted.map((g) => `<li>${g}</li>`).join('')}
          </ul>
          <p>Tagad varat pieteikties un sākt darbu platformā.</p>
        `,
        cta: { label: 'Sākt darbu', url: `${this.webUrl}/dashboard` },
      }),
    });
  }

  /** Application was rejected by admin */
  async sendApplicationRejected(
    to: string,
    firstName: string,
    reviewNote?: string,
  ) {
    const safeName = this.escape(firstName);
    const safeNote = this.escape(reviewNote);
    await this.send({
      to,
      subject: 'Pieteikuma statuss — B3Hub',
      html: this.base({
        title: 'Izskatījām jūsu pieteikumu',
        body: `
          <p>Labdien, ${safeName}!</p>
          <p>Diemžēl pēc izskatīšanas nevaram šobrīd apstiprināt jūsu pieteikumu.</p>
          ${safeNote ? `<p><strong>Komentārs:</strong> ${safeNote}</p>` : ''}
          <p>Ja jums ir jautājumi, lūdzu sazinieties ar mums rakstot uz <a href="mailto:support@b3hub.lv">support@b3hub.lv</a>.</p>
        `,
      }),
    });
  }

  /** Order confirmation to the buyer */
  async sendOrderConfirmation(
    to: string,
    buyerName: string,
    order: {
      orderNumber: string;
      total: number;
      currency: string;
      deliveryAddress?: string;
      deliveryCity?: string;
      items: Array<{
        quantity: number;
        unit: string;
        material: { name: string };
      }>;
    },
  ) {
    const safeBuyerName = this.escape(buyerName);
    const itemRows = order.items
      .map(
        (i) =>
          `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${this.escape(i.material.name)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${i.quantity} ${this.escape(i.unit)}</td>
          </tr>`,
      )
      .join('');

    const address = [order.deliveryAddress, order.deliveryCity]
      .filter(Boolean)
      .map((s) => this.escape(s))
      .join(', ');

    await this.send({
      to,
      subject: `Pasūtījums #${order.orderNumber} saņemts — B3Hub`,
      html: this.base({
        title: `Pasūtījums #${order.orderNumber} saņemts!`,
        body: `
          <p>Labdien, ${safeBuyerName}!</p>
          <p>Paldies par pasūtījumu. To esam saņēmuši un sāksim apstrādi tuvākajā laikā.</p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;font-weight:600">Materiāls</th>
                <th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb;font-weight:600">Daudzums</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          ${address ? `<p><strong>Piegādes adrese:</strong> ${address}</p>` : ''}
          <p style="font-size:16px;font-weight:700;margin-top:16px">
            Kopā: ${order.currency} ${order.total.toFixed(2)}
          </p>
        `,
        cta: {
          label: 'Skatīt pasūtījumu',
          url: `${this.webUrl}/dashboard/orders`,
        },
      }),
    });
  }

  /** Invoice issued — send to buyer with PDF attachment */
  async sendInvoice(
    to: string,
    buyerName: string,
    invoice: {
      invoiceNumber: string;
      total: number;
      currency: string;
      dueDate: Date;
      orderNumber: string;
    },
    pdfBuffer: Buffer,
  ) {
    const safeBuyerName = this.escape(buyerName);
    const dueDateStr = invoice.dueDate.toLocaleDateString('lv-LV');
    const html = this.base({
      title: `Rēķins #${invoice.invoiceNumber}`,
      body: `
        <p>Labdien, ${safeBuyerName}!</p>
        <p>Pielikumā atradīsiet rēķinu par pasūtījumu <strong>#${invoice.orderNumber}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#6b7280">Rēķina numurs</td>
            <td style="padding:8px 0;font-weight:600">#${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280">Apmaksas termiņš</td>
            <td style="padding:8px 0;font-weight:600">${dueDateStr}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280">Kopā apmaksai</td>
            <td style="padding:8px 0;font-size:18px;font-weight:700;color:#111827">${invoice.currency} ${invoice.total.toFixed(2)}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#6b7280">Lūdzu apmaksājiet rēķinu līdz ${dueDateStr}. Jautājumu gadījumā rakstiet uz <a href="mailto:support@b3hub.lv">support@b3hub.lv</a>.</p>
      `,
      cta: {
        label: 'Skatīt rēķinus',
        url: `${this.webUrl}/dashboard/invoices`,
      },
    });

    if (!this.enabled || !this.resend) {
      this.logger.debug(
        `[DEV EMAIL] Invoice #${invoice.invoiceNumber} to: ${to} (PDF ${pdfBuffer.length} bytes)`,
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: [to],
        subject: `Rēķins #${invoice.invoiceNumber} — B3Hub`,
        html,
        attachments: [
          {
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer.toString('base64'),
          },
        ],
      });
      if (error) {
        this.logger.error(
          `Failed to send invoice email to ${to}: ${error.message}`,
        );
      } else {
        this.logger.log(`Invoice #${invoice.invoiceNumber} emailed to ${to}`);
      }
    } catch (err) {
      this.logger.error(
        `Invoice email send exception: ${(err as Error).message}`,
      );
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Notify buyer when an order's status changes to CONFIRMED, DELIVERED, or CANCELLED */
  async sendOrderStatusUpdate(
    to: string,
    buyerName: string,
    order: { orderNumber: string; status: string },
  ) {
    const safeBuyerName = this.escape(buyerName);
    const STATUS_COPY: Record<
      string,
      { subject: string; title: string; body: string }
    > = {
      CONFIRMED: {
        subject: `Pasūtījums #${order.orderNumber} apstiprināts — B3Hub`,
        title: 'Pasūtījums apstiprināts!',
        body: `<p>Labdien, ${safeBuyerName}!</p><p>Jūsu pasūtījums <strong>#${order.orderNumber}</strong> ir <strong>apstiprināts</strong> no piegādātāja puses. Piegāde tiks veikta saskaņā ar norādīto grafiku.</p>`,
      },
      DELIVERED: {
        subject: `Pasūtījums #${order.orderNumber} piegādāts — B3Hub`,
        title: 'Pasūtījums piegādāts!',
        body: `<p>Labdien, ${safeBuyerName}!</p><p>Pasūtījums <strong>#${order.orderNumber}</strong> ir <strong>piegādāts</strong>. Ja ir jebkādas neatbilstības, lūdzu vērsieties pie mums 48 stundu laikā.</p>`,
      },
      CANCELLED: {
        subject: `Pasūtījums #${order.orderNumber} atcelts — B3Hub`,
        title: 'Pasūtījums atcelts',
        body: `<p>Labdien, ${safeBuyerName}!</p><p>Pasūtījums <strong>#${order.orderNumber}</strong> ir <strong>atcelts</strong>. Ja maksājums tika iekasēts, atmaksa tiks apstrādāta 3–5 darba dienu laikā.</p>`,
      },
    };

    const copy = STATUS_COPY[order.status];
    if (!copy) return; // unknown status — skip

    await this.send({
      to,
      subject: copy.subject,
      html: this.base({
        title: copy.title,
        body: copy.body,
        cta: {
          label: 'Skatīt pasūtījumu',
          url: `${this.webUrl}/dashboard/orders`,
        },
      }),
    });
  }

  /** Notify a seller when they receive a new quote request (RFQ) */
  async sendQuoteRequestReceived(
    to: string,
    sellerName: string,
    rfq: {
      requestNumber: string;
      category: string;
      quantity: number;
      unit: string;
      city: string;
    },
  ) {
    const safeSellerName = this.escape(sellerName);
    await this.send({
      to,
      subject: `Jauns cenu pieprasījums — B3Hub`,
      html: this.base({
        title: 'Saņemts jauns cenu pieprasījums',
        body: `
          <p>Labdien, ${safeSellerName}!</p>
          <p>Jūs saņēmāt jaunu cenu pieprasījumu <strong>#${rfq.requestNumber}</strong>:</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280">Kategorija</td><td style="padding:6px 0;font-weight:600">${this.escape(rfq.category)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Daudzums</td><td style="padding:6px 0;font-weight:600">${rfq.quantity} ${this.escape(rfq.unit)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Piegādes pilsēta</td><td style="padding:6px 0;font-weight:600">${this.escape(rfq.city)}</td></tr>
          </table>
          <p>Atbildiet uz pieprasījumu pēc iespējas ātrāk, lai palielinātu iespēju iegūt darījumu.</p>
        `,
        cta: {
          label: 'Skatīt pieprasījumu',
          url: `${this.webUrl}/dashboard/quote-requests`,
        },
      }),
    });
  }

  /** Notify a driver when they are assigned to a new transport job */
  async sendDriverJobAssigned(
    to: string,
    driverName: string,
    job: {
      jobNumber: string;
      pickupCity: string;
      deliveryCity: string;
      scheduledDate?: Date;
    },
  ) {
    const safeDriverName = this.escape(driverName);
    const dateStr = job.scheduledDate
      ? job.scheduledDate.toLocaleDateString('lv-LV')
      : 'pēc vienošanās';

    await this.send({
      to,
      subject: `Jums piešķirts transporta darbs — B3Hub`,
      html: this.base({
        title: `Jauns darbs #${job.jobNumber}`,
        body: `
          <p>Labdien, ${safeDriverName}!</p>
          <p>Jums ir piešķirts jauns transporta darbs:</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280">Iekraušanas vieta</td><td style="padding:6px 0;font-weight:600">${this.escape(job.pickupCity)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Piegādes vieta</td><td style="padding:6px 0;font-weight:600">${this.escape(job.deliveryCity)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Datums</td><td style="padding:6px 0;font-weight:600">${dateStr}</td></tr>
          </table>
          <p>Pieņemiet vai noraidiet darbu B3Hub lietotnē.</p>
        `,
        cta: {
          label: 'Atvērt lietotni',
          url: `${this.webUrl}/dashboard`,
        },
      }),
    });
  }

  /** Invoice overdue notification — sent when dueDate has passed */
  async sendInvoiceOverdue(
    to: string,
    buyerName: string,
    invoice: {
      invoiceNumber: string;
      total: number;
      daysLate: number;
      orderId: string;
    },
  ) {
    const safeBuyerName = this.escape(buyerName);
    await this.send({
      to,
      subject: `Nokavēts rēķins #${invoice.invoiceNumber} — B3Hub`,
      html: this.base({
        title: `Rēķins #${invoice.invoiceNumber} ir nokavēts`,
        body: `
          <p>Labdien, ${safeBuyerName}!</p>
          <p>Rēķins <strong>#${invoice.invoiceNumber}</strong> par summu <strong>€${invoice.total.toFixed(2)}</strong> ir nokavēts par <strong>${invoice.daysLate} dienu(ām)</strong>.</p>
          <p>Lūdzu, veiciet maksājumu pēc iespējas ātrāk, lai izvairītos no turpmākām sekām. Jautājumu gadījumā sazinieties ar mums: <a href="mailto:support@b3hub.lv">support@b3hub.lv</a>.</p>
        `,
        cta: {
          label: 'Apmaksāt rēķinu',
          url: `${this.webUrl}/dashboard/invoices`,
        },
      }),
    });
  }

  /** Invoice due-soon reminder — sent 3 days before dueDate */
  async sendInvoiceReminder(
    to: string,
    buyerName: string,
    invoice: {
      invoiceNumber: string;
      total: number;
      dueDate: Date;
      daysUntilDue: number;
      orderId: string;
    },
  ) {
    const safeBuyerName = this.escape(buyerName);
    const dueDateStr = invoice.dueDate.toLocaleDateString('lv-LV');
    await this.send({
      to,
      subject: `Atgādinājums: rēķins #${invoice.invoiceNumber} jāsamaksā ${dueDateStr} — B3Hub`,
      html: this.base({
        title: `Rēķins jāsamaksā ${invoice.daysUntilDue} dienu laikā`,
        body: `
          <p>Labdien, ${safeBuyerName}!</p>
          <p>Atgādinām, ka rēķins <strong>#${invoice.invoiceNumber}</strong> par summu <strong>€${invoice.total.toFixed(2)}</strong> jāsamaksā līdz <strong>${dueDateStr}</strong>.</p>
          <p>Apmaksājiet savlaicīgi, lai izvairītos no nokavēšanas.</p>
        `,
        cta: {
          label: 'Apmaksāt rēķinu',
          url: `${this.webUrl}/dashboard/invoices`,
        },
      }),
    });
  }

  /** Notify buyer when weigh-bridge reading differs >5% from ordered cargo weight */
  async sendWeighDiscrepancy(
    to: string,
    buyerName: string,
    data: {
      jobNumber: string;
      orderNumber: string;
      expectedTonnes: number;
      actualTonnes: number;
      diffPct: number;
    },
  ) {
    const safeBuyerName = this.escape(buyerName);
    const direction =
      data.actualTonnes > data.expectedTonnes ? 'vairāk' : 'mazāk';
    await this.send({
      to,
      subject: `Svara neatbilstība — Darbs #${data.jobNumber} — B3Hub`,
      html: this.base({
        title: 'Uzmanību: svara neatbilstība',
        body: `
          <p>Labdien, ${safeBuyerName}!</p>
          <p>Piegādes brauciena <strong>#${data.jobNumber}</strong> (pasūtījums <strong>#${data.orderNumber}</strong>) svara mērījums atšķiras no pasūtītā apjoma par vairāk nekā 5%.</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280">Pasūtītais svars</td><td style="padding:6px 0;font-weight:600">${data.expectedTonnes.toFixed(3)} t</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Reālais svars (svari)</td><td style="padding:6px 0;font-weight:600">${data.actualTonnes.toFixed(3)} t</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Starpība</td><td style="padding:6px 0;font-weight:600;color:#dc2626">${data.diffPct.toFixed(1)}% ${direction}</td></tr>
          </table>
          <p>Ja ir pretenzijas, lūdzu sazinieties ar mums 48 stundu laikā.</p>
        `,
        cta: {
          label: 'Skatīt pasūtījumu',
          url: `${this.webUrl}/dashboard/orders`,
        },
      }),
    });
  }

  /** Guest order confirmation — sent when no-account order is submitted */
  async sendGuestOrderConfirmation(
    to: string,
    contactName: string,
    orderNumber: string,
    trackingUrl: string,
    details: {
      materialName: string;
      quantity: number;
      unit: string;
      deliveryAddress: string;
      deliveryCity: string;
      deliveryDate?: Date;
      deliveryWindow?: string;
    },
  ) {
    const safeName = this.escape(contactName);
    const safeOrder = this.escape(orderNumber);
    const safeAddress = this.escape(details.deliveryAddress);
    const safeCity = this.escape(details.deliveryCity);
    const safeMaterial = this.escape(details.materialName);

    await this.send({
      to,
      subject: `Pasūtījums saņemts — ${safeOrder} — B3Hub`,
      html: this.base({
        title: 'Jūsu pasūtījums ir saņemts!',
        body: `
          <p>Labdien, ${safeName}!</p>
          <p>Paldies! Mēs saņēmām jūsu pasūtījumu <strong>${safeOrder}</strong>.</p>
          <table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:40%">Materiāls</td>
              <td style="padding:6px 0;font-weight:600">${safeMaterial} — ${details.quantity} ${details.unit}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280">Piegādes adrese</td>
              <td style="padding:6px 0;font-weight:600">${safeAddress}, ${safeCity}</td>
            </tr>
            ${details.deliveryDate ? `<tr><td style="padding:6px 0;color:#6b7280">Piegāde</td><td style="padding:6px 0;font-weight:600">${details.deliveryDate.toLocaleDateString('lv-LV')}${details.deliveryWindow ? ` ${details.deliveryWindow}` : ''}</td></tr>` : ''}
          </table>
          <p>Mūsu komanda ar jums sazināsies tuvākajā laikā. Pasūtījuma statusu var sekot, izmantojot zemāk esošo saiti.</p>
          <p style="font-size:12px;color:#9ca3af">Jautājumu gadījumā: <a href="mailto:info@b3hub.lv">info@b3hub.lv</a></p>
        `,
        cta: { label: 'Sekot pasūtījumam', url: trackingUrl },
        footer: 'Pasūtījuma numurs: ' + safeOrder,
      }),
    });
  }

  /** Escapes HTML special chars so user-supplied strings cannot inject HTML */
  private escape(str: string | undefined | null): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    if (!this.enabled || !this.resend) {
      // Dev mode: log the email to console so developers can see it
      this.logger.debug(
        `[DEV EMAIL] To: ${opts.to} | Subject: ${opts.subject}`,
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      });

      if (error) {
        this.logger.error(
          `Failed to send email to ${opts.to}: ${error.message}`,
        );
      } else {
        this.logger.log(`Email sent to ${opts.to}: ${opts.subject}`);
      }
    } catch (err) {
      // Non-fatal — never let email failure crash the request
      this.logger.error(`Email send exception: ${(err as Error).message}`);
    }
  }

  /** Shared branded HTML wrapper */
  private base(opts: {
    title: string;
    body: string;
    cta?: { label: string; url: string };
    footer?: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="lv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

          <!-- Header -->
          <tr>
            <td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 40px">
              <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px">B3Hub</span>
              <span style="color:#9ca3af;font-size:13px;margin-left:12px">Platforma</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px">
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${opts.title}</h1>
              <div style="font-size:15px;color:#374151;line-height:1.7">${opts.body}</div>
              ${
                opts.cta
                  ? `<div style="margin-top:32px">
                      <a href="${opts.cta.url}"
                         style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700">
                        ${opts.cta.label}
                      </a>
                    </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
                ${opts.footer ?? 'Šis ir automātiski ģenerēts ziņojums no B3Hub platformas. Lūdzu, neatbildiet uz šo e-pastu.'}
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af">
                &copy; ${new Date().getFullYear()} B3Hub. Visas tiesības aizsargātas.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
