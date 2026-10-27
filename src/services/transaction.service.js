import transactionRepository from "../repositories/transaction.repository.js";

async function createTransaction(accountId, data) {
  return transactionRepository.create(accountId, data);
}

async function getBalance(accountId) {
  return transactionRepository.getBalance(accountId);
}

async function getHistory(accountId, { type, page, limit }) {
  const result = await transactionRepository.getHistory(accountId, {
    type,
    limit,
    offset: (page - 1) * limit,
  });

  return {
    transactions: result.transactions,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  };
}

export default {
  createTransaction,
  getBalance,
  getHistory,
};
