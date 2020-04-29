import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface RequestDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: RequestDTO): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const { total } = await transactionsRepository.getBalance();

    if (type === 'outcome' && value > total) {
      // if there isn´t enough 'money' to take
      throw new AppError('Error');
    }

    const categoryRepository = getRepository(Category);
    let categoryNew = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });

    if (!categoryNew) {
      // if already exist this category
      categoryNew = categoryRepository.create({
        title: category,
      });
      await categoryRepository.save(categoryNew);
    }

    const transaction = transactionsRepository.create({
      value,
      title,
      type,
      category: categoryNew,
    });
    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
