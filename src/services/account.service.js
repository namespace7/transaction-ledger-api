import accountRepository from "../repositories/account.repository.js";

async function createAccount(name) {
  return accountRepository.create(name);
}

async function getAccount(id) {
  return accountRepository.findById(id);
}

export default {
  createAccount,
  getAccount,
};
