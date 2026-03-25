import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { RequestingUser } from '../common/types/requesting-user.interface';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2025-02-24.acacia', // Use latest or compatible version
      });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not found in env');
    }
  }

  /**
   * Create a PaymentIntent for an Order.
   * This authorizes the amount on the buyer's card.
   */
  async createPaymentIntent(orderId: string, user: RequestingUser) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true }, // To get customer details if needed
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.createdById !== user.userId && user.userType !== 'ADMIN') {
        // Basic check, might need more robust permission logic
        throw new BadRequestException('Not authorized to pay for this order');
    }

    // Amount in cents
    const amount = Math.round(order.total * 100);

    // Create PaymentIntent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: order.currency.toLowerCase(),
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      capture_method: 'manual', // Authorize only, capture later
    });

    // Create or update Payment record
    await this.prisma.payment.upsert({
      where: { orderId: orderId },
      create: {
        orderId: orderId,
        stripePaymentId: paymentIntent.id,
        amount: order.total,
        currency: order.currency,
        status: 'PENDING',
      },
      update: {
        stripePaymentId: paymentIntent.id,
        amount: order.total,
        currency: order.currency,
        status: 'PENDING',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      publishableKey: this.configService.get('STRIPE_PUBLISHABLE_KEY'),
    };
  }

  /**
   * Generate a Stripe Connect Express onboarding link for a seller/carrier.
   */
  async createConnectAccountLink(user: RequestingUser) {
    if (!this.stripe) {
        throw new BadRequestException('Stripe is not configured');
    }
    
    // Ensure user has a company
    const companyId = user.companyId;
    if (!companyId) {
        throw new BadRequestException('User must belong to a company to receive payouts');
    }

    const company = await this.prisma.company.findUnique({
        where: { id: companyId },
    });

    if (!company) throw new BadRequestException('Company not found');

    let accountId = company.stripeConnectId;

    if (!accountId) {
        // Create a new Express account
        const account = await this.stripe.accounts.create({
            type: 'express',
            country: company.country || 'LV', // Default to Latvia or use company country
            email: company.email,
            business_type: 'company',
            capabilities: {
                transfers: { requested: true },
            },
        });
        accountId = account.id;

        // Save to DB
        await this.prisma.company.update({
            where: { id: companyId },
            data: { stripeConnectId: accountId },
        });
    }

    // Create an account link for onboarding
    const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${this.configService.get('WEB_BASE_URL')}/dashboard/supplier/earnings?refresh=true`,
        return_url: `${this.configService.get('WEB_BASE_URL')}/dashboard/supplier/earnings?success=true`,
        type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  /**
   * Capture funds when order is confirmed/in-progress.
   */
  async capturePayment(orderId: string) {
       if (!this.stripe) return;

       const payment = await this.prisma.payment.findUnique({
           where: { orderId },
       });

       if (!payment || !payment.stripePaymentId) {
           throw new BadRequestException('No payment found for this order');
       }

       if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
           return; // Already captured
       }

       try {
           const paymentIntent = await this.stripe.paymentIntents.capture(payment.stripePaymentId);
           
           if (paymentIntent.status === 'succeeded') {
                await this.prisma.payment.update({
                    where: { orderId },
                    data: { status: 'CAPTURED' },
                });
           }
       } catch (error) {
           this.logger.error(`Failed to capture payment for order ${orderId}: ${error.message}`);
           throw error;
       }
  }

    /**
   * Release funds (Transfer) to seller and driver.
   * Called when order is COMPLETED.
   */
  async releaseFunds(orderId: string) {
      if (!this.stripe) return;
      
      const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: { items: { include: { material: true } } },
      });
      // Retrieve Supplier Company
      // Calculate split
      // Transfer to Connect ID
  }
}
