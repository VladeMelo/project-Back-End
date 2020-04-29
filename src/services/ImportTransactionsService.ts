import csvParse from 'csv-parse';

import fs from 'fs';
import { getRepository, getCustomRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transationsRepository = getCustomRepository(TransactionsRepository);

    const contactsReadStream = fs.createReadStream(filePath); // stream that will listen to our archive, piece by piece

    const parsers = csvParse({
      from_line: 2, // starts from line 2
    });

    const parseCSV = contactsReadStream.pipe(parsers); // whenever 'contactsReadStrem' has an available information will send it to the other stream, 'parsers'

    // implementing 'bulk insert' -> less connections(open/close) with the database
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve)); // this Promise will execute the method resolve when the Event Listener reach .on('end')

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      category => category.title,
    );

    const addCategoriesTitles = Array.from(
      new Set(
        categories.filter(
          category => !existentCategoriesTitles.includes(category),
        ),
      ),
    );

    const newCategories = categoriesRepository.create(
      addCategoriesTitles.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories.map(category => category));

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transationsRepository.create(
      transactions.map(({ category, title, type, value }) => ({
        title,
        value,
        type,
        category: finalCategories.find(
          categoryMatchTransaction =>
            categoryMatchTransaction.title === category,
        ),
      })),
    );

    await transationsRepository.save(createdTransactions);

    await fs.promises.unlink(filePath); // deleting the archive

    return createdTransactions;
  }
}

export default ImportTransactionsService;
