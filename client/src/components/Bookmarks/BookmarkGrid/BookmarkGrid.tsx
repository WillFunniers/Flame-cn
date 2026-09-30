import { Link } from 'react-router-dom';

import classes from './BookmarkGrid.module.css';

import { Category } from '../../../interfaces';

import { BookmarkCard } from '../BookmarkCard/BookmarkCard';
import { Message } from '../../UI';

// i18n
import { useT } from '../../../i18n';

interface Props {
  categories: Category[];
  totalCategories?: number;
  searching: boolean;
  fromHomepage?: boolean;
}

export const BookmarkGrid = (props: Props): JSX.Element => {
  const t = useT();

  const {
    categories,
    totalCategories,
    searching,
    fromHomepage = false,
  } = props;

  let bookmarks: JSX.Element;

  if (categories.length) {
    if (searching && !categories[0].bookmarks.length) {
      bookmarks = <Message>{t('bookmarks.noMatch')}</Message>;
    } else {
      bookmarks = (
        <div className={classes.BookmarkGrid}>
          {categories.map((category: Category): JSX.Element => (
            <BookmarkCard
              category={category}
              fromHomepage={fromHomepage}
              key={category.id}
            />
          ))}
        </div>
      );
    }
  } else {
    if (totalCategories) {
      bookmarks = (
        <Message>
          {t('bookmarks.emptyPinnedPrefix')}
          <Link to="/bookmarks">/bookmarks</Link>
          {t('bookmarks.emptyPinnedSuffix')}
        </Message>
      );
    } else {
      bookmarks = (
        <Message>
          {t('bookmarks.emptyNonePrefix')}
          <Link to="/bookmarks">/bookmarks</Link>
          {t('bookmarks.emptyNoneSuffix')}
        </Message>
      );
    }
  }

  return bookmarks;
};
