import { ActionContext, Context, Request, Response } from '@frontastic/extension-types';
import { Cart } from '@Types/cart/Cart';
import { LineItem } from '@Types/cart/LineItem';
import { Address } from '@Types/account/Address';
import { ShippingMethod } from '@Types/cart/ShippingMethod';
import { Payment, PaymentStatuses } from '@Types/cart/Payment';
import { DiscountCode } from '@Types/cart/Discount';
import { SortAttributes, SortOrder } from '@Types/query/ProductQuery';
import { OrderQuery } from '@Types/query';
import { Token } from '@Types/Token';
import { CartFetcher } from '../utils/CartFetcher';
import { getLocale } from '../utils/Request';
import { EmailApiFactory } from '../utils/EmailApiFactory';
import queryParamsToStates from '@Commerce-commercetools/utils/queryParamsToState';
import queryParamsToIds from '@Commerce-commercetools/utils/queryParamsToIds';
import handleError from '@Commerce-commercetools/utils/handleError';
import { CartNotMatchOrderError } from '@Commerce-commercetools/errors/CartNotMatchOrderError';
import { ValidationError } from '@Commerce-commercetools/errors/ValidationError';
import { AccountFetcher } from '@Commerce-commercetools/utils/AccountFetcher';
import getCartApi from '@Commerce-commercetools/utils/apiFactory/getCartApi';
import { QueryParams } from '@Commerce-commercetools/interfaces/QueryParams';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

function queryParamsToSortAttributes(queryParams: QueryParams) {
  const sortAttributes: SortAttributes = {};

  if (queryParams.sortAttributes) {
    let sortAttribute;

    for (sortAttribute of Object.values(queryParams.sortAttributes)) {
      const key = Object.keys(sortAttribute)[0];
      sortAttributes[key] = sortAttribute[key] ? sortAttribute[key] : SortOrder.ASCENDING;
    }
  }

  return sortAttributes;
}

async function updateCartFromRequest(request: Request, context: Context): Promise<Cart> {
  const cartApi = getCartApi(request, context);

  let cart = await CartFetcher.fetchCart(request, context);

  if (request?.body === undefined || request?.body === '') {
    return cart;
  }

  const body: {
    account?: { email?: string };
    shipping?: Address;
    billing?: Address;
  } = JSON.parse(request.body);

  if (body?.account?.email !== undefined) {
    cart = await cartApi.setEmail(cart, body.account.email);
  }

  if (body?.shipping !== undefined || body?.billing !== undefined) {
    const shippingAddress = body?.shipping ?? body.billing;
    const billingAddress = body?.billing ?? body.shipping;

    cart = await cartApi.setShippingAddress(cart, shippingAddress);
    cart = await cartApi.setBillingAddress(cart, billingAddress);
  }

  return cart;
}

export const getCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    try {
      const cart = await CartFetcher.fetchActiveCartFromSession(request, actionContext.frontasticContext);

      return {
        statusCode: 200,
        body: cart ? JSON.stringify(cart) : JSON.stringify({}),
        sessionData: {
          ...cartApi.getSessionData(),
          ...(cart ? { cartId: cart.cartId } : {}),
        },
      };
    } catch (error) {
      const errorResponse = error as Error;
      return {
        statusCode: 400,
        message: errorResponse.message,
      };
    }
  } catch (error) {
    return handleError(error, request);
  }
};

export const resetCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = getCartApi(request, actionContext.frontasticContext);
  cartApi.invalidateSessionCheckoutData();

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify({}),
    sessionData: {
      ...request.sessionData,
      cartId: undefined,
    },
  };

  return response;
};

export const addToCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const body: {
      variant?: { sku?: string; count: number };
    } = JSON.parse(request.body);

    const lineItem: LineItem = {
      variant: {
        sku: body.variant?.sku || undefined,
        price: undefined,
      },
      count: +body.variant?.count || 1,
    };

    let cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);
    cart = await cartApi.addToCart(cart, lineItem);

    const cartId = cart.cartId;

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const replicateCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const orderId = request.query?.['orderId'];

    if (!orderId) {
      throw new ValidationError({ message: `orderId is required` });
    }

    const cart = await cartApi.replicateCart(orderId);

    return {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId: cart.cartId,
      },
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const updateLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const body: {
      lineItem?: { id?: string; count: number };
    } = JSON.parse(request.body);

    const lineItem: LineItem = {
      lineItemId: body.lineItem?.id,
      count: +body.lineItem?.count || 1,
    };

    let cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);
    cart = await cartApi.updateLineItem(cart, lineItem);

    const cartId = cart.cartId;

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const removeLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const body: {
      lineItem?: { id?: string };
    } = JSON.parse(request.body);

    const lineItem: LineItem = {
      lineItemId: body.lineItem?.id,
    };

    let cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);
    cart = await cartApi.removeLineItem(cart, lineItem);

    const cartId = cart.cartId;

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const updateCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const cart = await updateCartFromRequest(request, actionContext.frontasticContext);
    const cartId = cart.cartId;

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const checkout: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const locale = getLocale(request);
    const body: {
      purchaseOrderNumber?: string;
    } = JSON.parse(request.body);

    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const emailApi = EmailApiFactory.getDefaultApi(actionContext.frontasticContext, locale);

    const cart = await updateCartFromRequest(request, actionContext.frontasticContext);

    const order = await cartApi.order(cart, body?.purchaseOrderNumber);

    await emailApi.sendOrderConfirmationEmail({ ...order, email: order.email || cart.email });

    // Unset the cartId
    const cartId: string = undefined;

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(order),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const getShippingMethods: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const onlyMatching = request.query.onlyMatching === 'true';

    const shippingMethods = await cartApi.getShippingMethods(onlyMatching);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(shippingMethods),
      sessionData: {
        ...cartApi.getSessionData(),
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const getAvailableShippingMethods: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);

    const availableShippingMethods = await cartApi.getAvailableShippingMethods(cart);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(availableShippingMethods),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId: cart.cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const setShippingMethod: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    let cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);

    const body: {
      shippingMethod?: { id?: string };
    } = JSON.parse(request.body);

    const shippingMethod: ShippingMethod = {
      shippingMethodId: body.shippingMethod?.id,
    };

    cart = await cartApi.setShippingMethod(cart, shippingMethod);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId: cart.cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const addPaymentByInvoice: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    let cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);

    const body: {
      payment?: Payment;
    } = JSON.parse(request.body);

    const payment: Payment = {
      ...body.payment,
      paymentProvider: 'frontastic',
      paymentMethod: 'invoice',
      paymentStatus: PaymentStatuses.PENDING,
    };

    payment.amountPlanned ??= {};

    payment.amountPlanned.centAmount = payment.amountPlanned.centAmount ?? cart.sum.centAmount ?? undefined;
    payment.amountPlanned.currencyCode = payment.amountPlanned.currencyCode ?? cart.sum.currencyCode ?? undefined;

    cart = await cartApi.addPayment(cart, payment);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId: cart.cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const updatePayment: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);

    const body: {
      payment?: Payment;
    } = JSON.parse(request.body);

    const payment = await cartApi.updatePayment(cart, body.payment);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(payment),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId: cart.cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const redeemDiscount: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    let cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);

    const body: {
      code?: string;
    } = JSON.parse(request.body);

    cart = await cartApi.redeemDiscountCode(cart, body.code);

    return {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId: cart.cartId,
      },
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const removeDiscount: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    let cart = await CartFetcher.fetchCart(request, actionContext.frontasticContext);

    const body: {
      discountCodeId?: string;
    } = JSON.parse(request.body);

    const discount: DiscountCode = {
      discountCodeId: body?.discountCodeId,
    };

    cart = await cartApi.removeDiscountCode(cart, discount);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(cart),
      sessionData: {
        ...cartApi.getSessionData(),
        cartId: cart.cartId,
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const queryOrders: ActionHook = async (request: Request, actionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    const accountId = AccountFetcher.fetchAccountIdFromSessionEnsureLoggedIn(request);

    const orderQuery: OrderQuery = {
      accountId: accountId,
      limit: request.query?.limit ?? undefined,
      cursor: request.query?.cursor ?? undefined,
      orderNumbers: queryParamsToIds('orderNumbers', request.query),
      orderIds: queryParamsToIds('orderIds', request.query),
      orderState: queryParamsToStates('orderStates', request.query),
      sortAttributes: queryParamsToSortAttributes(request.query),
      query: request.query?.query ?? undefined,
    };

    const queryResult = await cartApi.queryOrders(orderQuery);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(queryResult),
      sessionData: {
        ...cartApi.getSessionData(),
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const getOrder: ActionHook = async (request, actionContext) => {
  try {
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    // For order confirmation page we need to consider that the order might be placed by an anonymous user.
    // In that case, the accountId will be undefined
    const accountId = AccountFetcher.fetchAccountIdFromSession(request);

    const orderQuery: OrderQuery = {
      accountId: accountId,
      orderIds: [request.query?.orderId],
      limit: 1,
    };

    const queryResult = await cartApi.queryOrders(orderQuery);

    // We'll consider the first order as the checkout order
    const order = queryResult.items[0];

    if (accountId === undefined) {
      // For anonymous users, we need to validate if the order belongs to the current session cart
      // This is to avoid that an anonymous user can access an order of a different user
      if (order?.cartId !== request.sessionData?.cartId) {
        throw new CartNotMatchOrderError({ message: 'Order does not match the current cart.' });
      }
    }

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(order),
      sessionData: {
        ...cartApi.getSessionData(),
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};

export const getCheckoutSessionToken: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    let checkoutSessionToken: Token;
    const cartApi = getCartApi(request, actionContext.frontasticContext);

    // We are getting the cartId from the session data so carts that are not active can be used
    const cartId = request.sessionData?.cartId;

    if (cartId !== undefined) {
      checkoutSessionToken = await cartApi.getCheckoutSessionToken(cartId);
    }

    const response: Response = {
      statusCode: 200,
      body: checkoutSessionToken ? JSON.stringify(checkoutSessionToken) : '',
      sessionData: {
        ...cartApi.getSessionData(),
      },
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};
