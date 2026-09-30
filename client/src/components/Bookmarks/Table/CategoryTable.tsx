import { useState, useEffect, Fragment } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from 'react-beautiful-dnd';
import { Link } from 'react-router-dom';

// Redux
import { useDispatch, useSelector } from 'react-redux';
import { State } from '../../../store/reducers';
import { bindActionCreators } from 'redux';
import { actionCreators } from '../../../store';

// Typescript
import { Bookmark, Category } from '../../../interfaces';

// UI
import { Message, Table } from '../../UI';
import { TableActions } from '../../Actions/TableActions';

// i18n
import { useT } from '../../../i18n';

interface Props {
  openFormForUpdating: (data: Category | Bookmark) => void;
}

export const CategoryTable = ({ openFormForUpdating }: Props): JSX.Element => {
  const t = useT();

  const {
    config: { config },
    bookmarks: { categories },
  } = useSelector((state: State) => state);

  const dispatch = useDispatch();
  const {
    pinCategory,
    deleteCategory,
    createNotification,
    reorderCategories,
    updateCategory,
  } = bindActionCreators(actionCreators, dispatch);

  const [localCategories, setLocalCategories] = useState<Category[]>([]);

  // Copy categories array
  useEffect(() => {
    setLocalCategories([...categories]);
  }, [categories]);

  // Drag and drop handler
  const dragEndHanlder = (result: DropResult): void => {
    if (config.useOrdering !== 'orderId') {
      createNotification({
        title: t('notify.error'),
        message: t('error.customOrderDisabled'),
      });
      return;
    }

    if (!result.destination) {
      return;
    }

    const tmpCategories = [...localCategories];
    const [movedCategory] = tmpCategories.splice(result.source.index, 1);
    tmpCategories.splice(result.destination.index, 0, movedCategory);

    setLocalCategories(tmpCategories);
    reorderCategories(tmpCategories);
  };

  // Action handlers
  const deleteCategoryHandler = (id: number, name: string) => {
    const proceed = window.confirm(
      t('bookmarks.deleteCategoryConfirm', { name })
    );

    if (proceed) {
      deleteCategory(id);
    }
  };

  const updateCategoryHandler = (id: number) => {
    const category = categories.find((c) => c.id === id) as Category;
    openFormForUpdating(category);
  };

  const pinCategoryHandler = (id: number) => {
    const category = categories.find((c) => c.id === id) as Category;
    pinCategory(category);
  };

  const changeCategoryVisibiltyHandler = (id: number) => {
    const category = categories.find((c) => c.id === id) as Category;
    updateCategory(id, { ...category, isPublic: !category.isPublic });
  };

  return (
    <Fragment>
      <Message isPrimary={false}>
        {config.useOrdering === 'orderId' ? (
          <p>{t('bookmarks.dragReorderCategoriesHint')}</p>
        ) : (
          <p>
            {t('bookmarks.customOrderDisabledBefore')}
            <Link to="/settings/general">{t('bookmarks.settingsLink')}</Link>
          </p>
        )}
      </Message>

      <DragDropContext onDragEnd={dragEndHanlder}>
        <Droppable droppableId="categories">
          {(provided) => (
            <Table
              headers={[t('ui.name'), t('ui.visibility'), t('ui.actions')]}
              innerRef={provided.innerRef}
            >
              {localCategories.map((category, index): JSX.Element => {
                return (
                  <Draggable
                    key={category.id}
                    draggableId={category.id.toString()}
                    index={index}
                  >
                    {(provided, snapshot) => {
                      const style = {
                        border: snapshot.isDragging
                          ? '1px solid var(--color-accent)'
                          : 'none',
                        borderRadius: '4px',
                        ...provided.draggableProps.style,
                      };

                      return (
                        <tr
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          ref={provided.innerRef}
                          style={style}
                        >
                          <td style={{ width: '300px' }}>{category.name}</td>
                          <td style={{ width: '300px' }}>
                            {category.isPublic
                              ? t('bookmarks.visible')
                              : t('bookmarks.hidden')}
                          </td>

                          {!snapshot.isDragging && (
                            <TableActions
                              entity={category}
                              deleteHandler={deleteCategoryHandler}
                              updateHandler={updateCategoryHandler}
                              pinHanlder={pinCategoryHandler}
                              changeVisibilty={changeCategoryVisibiltyHandler}
                            />
                          )}
                        </tr>
                      );
                    }}
                  </Draggable>
                );
              })}
            </Table>
          )}
        </Droppable>
      </DragDropContext>
    </Fragment>
  );
};
