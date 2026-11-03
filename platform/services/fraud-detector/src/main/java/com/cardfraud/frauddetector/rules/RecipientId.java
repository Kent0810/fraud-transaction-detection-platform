package com.cardfraud.frauddetector.rules;

import java.util.Locale;

import com.cardfraud.frauddetector.model.Transaction;

// Who a transaction pays, as one string. recipient.ts in the cardholder backend builds the same ids: keep them in step.
//   account:<bank code>:<account number>   a transfer, matched by its account and never by the name typed on it
//   merchant:<name>                        a card payment, ignoring case and surrounding spaces
public final class RecipientId {
    private RecipientId() {
    }

    public static String of(Transaction txn) {
        if (Transaction.TRANSFER.equals(txn.channel()) && txn.recipientAccount() != null) {
            return "account:" + txn.recipientAccount();
        }
        String merchant = txn.merchant() == null ? "" : txn.merchant();
        return "merchant:" + merchant.trim().toLowerCase(Locale.ROOT);
    }
}
