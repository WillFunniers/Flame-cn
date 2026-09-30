import { useState, ChangeEvent, useEffect, FormEvent } from 'react';

// Redux
import { useDispatch, useSelector } from 'react-redux';
import { State } from '../../../store/reducers';
import { bindActionCreators } from 'redux';
import { actionCreators } from '../../../store';

// Typescript
import { Bookmark, Category, NewBookmark } from '../../../interfaces';

// UI
import { ModalForm, InputGroup, Button } from '../../UI';

// CSS
import classes from './Form.module.css';

// Utils
import { inputHandler, newBookmarkTemplate } from '../../../utility';

// i18n
import { useT } from '../../../i18n';

// Maps a validated form field to the key used in the "field cannot be empty"
// message, so the label is localised while English stays verbatim ("name").
const FIELD_KEYS: Record<string, string> = {
  name: 'error.fieldName',
  url: 'error.fieldUrl',
  icon: 'error.fieldIcon',
};

interface Props {
  modalHandler: () => void;
  bookmark?: Bookmark;
}

export const BookmarksForm = ({
  bookmark,
  modalHandler,
}: Props): JSX.Element => {
  const t = useT();

  const { categories } = useSelector((state: State) => state.bookmarks);

  const dispatch = useDispatch();
  const { addBookmark, updateBookmark, createNotification } =
    bindActionCreators(actionCreators, dispatch);

  const [useCustomIcon, toggleUseCustomIcon] = useState<boolean>(false);
  const [customIcon, setCustomIcon] = useState<File | null>(null);

  const [formData, setFormData] = useState<NewBookmark>(newBookmarkTemplate);

  // Load bookmark data if provided for editing
  useEffect(() => {
    if (bookmark) {
      setFormData({ ...bookmark });
    } else {
      setFormData(newBookmarkTemplate);
    }
  }, [bookmark]);

  const inputChangeHandler = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    options?: { isNumber?: boolean; isBool?: boolean }
  ) => {
    inputHandler<NewBookmark>({
      e,
      options,
      setStateHandler: setFormData,
      state: formData,
    });
  };

  const fileChangeHandler = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) {
      setCustomIcon(e.target.files[0]);
    }
  };

  // Bookmarks form handler
  const formSubmitHandler = (e: FormEvent): void => {
    e.preventDefault();

    for (let field of ['name', 'url', 'icon'] as const) {
      if (/^ +$/.test(formData[field])) {
        createNotification({
          title: t('notify.error'),
          message: t('error.fieldEmpty', { field: t(FIELD_KEYS[field]) }),
        });

        return;
      }
    }

    const createFormData = (): FormData => {
      const data = new FormData();
      if (customIcon) {
        data.append('icon', customIcon);
      }
      data.append('name', formData.name);
      data.append('url', formData.url);
      data.append('categoryId', `${formData.categoryId}`);
      data.append('isPublic', `${formData.isPublic ? 1 : 0}`);

      return data;
    };

    const checkCategory = (): boolean => {
      if (formData.categoryId < 0) {
        createNotification({
          title: t('notify.error'),
          message: t('error.selectCategory'),
        });

        return false;
      }

      return true;
    };

    if (!bookmark) {
      // add new bookmark
      if (!checkCategory()) return;

      if (formData.categoryId < 0) {
        createNotification({
          title: t('notify.error'),
          message: t('error.selectCategory'),
        });
        return;
      }

      if (customIcon) {
        const data = createFormData();
        addBookmark(data);
      } else {
        addBookmark(formData);
      }

      setFormData({
        ...newBookmarkTemplate,
        categoryId: formData.categoryId,
        isPublic: formData.isPublic,
      });
    } else {
      // update
      if (!checkCategory()) return;

      if (customIcon) {
        const data = createFormData();
        updateBookmark(bookmark.id, data, {
          prev: bookmark.categoryId,
          curr: formData.categoryId,
        });
      } else {
        updateBookmark(bookmark.id, formData, {
          prev: bookmark.categoryId,
          curr: formData.categoryId,
        });
      }

      modalHandler();
    }

    setFormData({ ...newBookmarkTemplate, categoryId: formData.categoryId });
    setCustomIcon(null);
  };

  return (
    <ModalForm modalHandler={modalHandler} formHandler={formSubmitHandler}>
      {/* NAME */}
      <InputGroup>
        <label htmlFor="name">{t('bookmarks.bookmarkName')}</label>
        <input
          type="text"
          name="name"
          id="name"
          placeholder="Reddit"
          required
          value={formData.name}
          onChange={(e) => inputChangeHandler(e)}
        />
      </InputGroup>

      {/* URL */}
      <InputGroup>
        <label htmlFor="url">{t('bookmarks.bookmarkUrl')}</label>
        <input
          type="text"
          name="url"
          id="url"
          placeholder="reddit.com"
          required
          value={formData.url}
          onChange={(e) => inputChangeHandler(e)}
        />
      </InputGroup>

      {/* CATEGORY */}
      <InputGroup>
        <label htmlFor="categoryId">{t('bookmarks.bookmarkCategory')}</label>
        <select
          name="categoryId"
          id="categoryId"
          required
          onChange={(e) => inputChangeHandler(e, { isNumber: true })}
          value={formData.categoryId}
        >
          <option value={-1}>{t('ui.selectCategory')}</option>
          {categories.map((category: Category): JSX.Element => {
            return (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            );
          })}
        </select>
      </InputGroup>

      {/* ICON */}
      {!useCustomIcon ? (
        // mdi
        <InputGroup>
          <label htmlFor="icon">{t('bookmarks.bookmarkIconOptional')}</label>
          <input
            type="text"
            name="icon"
            id="icon"
            placeholder="book-open-outline"
            value={formData.icon}
            onChange={(e) => inputChangeHandler(e)}
          />
          <span>
            {t('ui.iconHint')}
            <a href="https://materialdesignicons.com/" target="blank">
              {' '}
              {t('ui.clickForReference')}
            </a>
          </span>
          <span
            onClick={() => toggleUseCustomIcon(!useCustomIcon)}
            className={classes.Switch}
          >
            {t('ui.switchToCustomIcon')}
          </span>
        </InputGroup>
      ) : (
        // custom
        <InputGroup>
          <label htmlFor="icon">{t('bookmarks.bookmarkIconOptional')}</label>
          <input
            type="file"
            name="icon"
            id="icon"
            onChange={(e) => fileChangeHandler(e)}
            accept=".jpg,.jpeg,.png,.svg,.ico"
          />
          <span
            onClick={() => {
              setCustomIcon(null);
              toggleUseCustomIcon(!useCustomIcon);
            }}
            className={classes.Switch}
          >
            {t('ui.switchToMdi')}
          </span>
        </InputGroup>
      )}

      {/* VISIBILTY */}
      <InputGroup>
        <label htmlFor="isPublic">{t('bookmarks.bookmarkVisibility')}</label>
        <select
          id="isPublic"
          name="isPublic"
          value={formData.isPublic ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('ui.visibleOption')}</option>
          <option value={0}>{t('ui.hiddenOption')}</option>
        </select>
      </InputGroup>

      <Button>
        {bookmark
          ? t('bookmarks.updateBookmark')
          : t('bookmarks.addNewBookmark')}
      </Button>
    </ModalForm>
  );
};
