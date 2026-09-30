import { Fragment, useState, useEffect } from 'react';
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
import { App } from '../../../interfaces';

// Other
import { Message, Table } from '../../UI';
import { TableActions } from '../../Actions/TableActions';

// i18n
import { useT } from '../../../i18n';

interface Props {
  openFormForUpdating: (app: App) => void;
}

export const AppTable = (props: Props): JSX.Element => {
  const t = useT();

  const {
    apps: { apps },
    config: { config },
  } = useSelector((state: State) => state);

  const dispatch = useDispatch();
  const { pinApp, deleteApp, reorderApps, createNotification, updateApp } =
    bindActionCreators(actionCreators, dispatch);

  const [localApps, setLocalApps] = useState<App[]>([]);

  // Copy apps array
  useEffect(() => {
    setLocalApps([...apps]);
  }, [apps]);

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

    const tmpApps = [...localApps];
    const [movedApp] = tmpApps.splice(result.source.index, 1);
    tmpApps.splice(result.destination.index, 0, movedApp);

    setLocalApps(tmpApps);
    reorderApps(tmpApps);
  };

  // Action handlers
  const deleteAppHandler = (id: number, name: string) => {
    const proceed = window.confirm(t('apps.deleteConfirm', { name }));

    if (proceed) {
      deleteApp(id);
    }
  };

  const updateAppHandler = (id: number) => {
    const app = apps.find((a) => a.id === id) as App;
    props.openFormForUpdating(app);
  };

  const pinAppHandler = (id: number) => {
    const app = apps.find((a) => a.id === id) as App;
    pinApp(app);
  };

  const changeAppVisibiltyHandler = (id: number) => {
    const app = apps.find((a) => a.id === id) as App;
    updateApp(id, { ...app, isPublic: !app.isPublic });
  };

  return (
    <Fragment>
      <Message isPrimary={false}>
        {config.useOrdering === 'orderId' ? (
          <p>{t('apps.dragReorderHint')}</p>
        ) : (
          <p>
            {t('apps.customOrderDisabledBefore')}
            <Link to="/settings/general">{t('apps.settingsLink')}</Link>
          </p>
        )}
      </Message>

      <DragDropContext onDragEnd={dragEndHanlder}>
        <Droppable droppableId="apps">
          {(provided) => (
            <Table
              headers={[
                t('ui.name'),
                t('ui.url'),
                t('ui.icon'),
                t('ui.visibility'),
                t('ui.actions'),
              ]}
              innerRef={provided.innerRef}
            >
              {localApps.map((app: App, index): JSX.Element => {
                return (
                  <Draggable
                    key={app.id}
                    draggableId={app.id.toString()}
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
                          <td style={{ width: '200px' }}>{app.name}</td>
                          <td style={{ width: '200px' }}>{app.url}</td>
                          <td style={{ width: '200px' }}>{app.icon}</td>
                          <td style={{ width: '200px' }}>
                            {app.isPublic
                              ? t('apps.visible')
                              : t('apps.hidden')}
                          </td>

                          {!snapshot.isDragging && (
                            <TableActions
                              entity={app}
                              deleteHandler={deleteAppHandler}
                              updateHandler={updateAppHandler}
                              pinHanlder={pinAppHandler}
                              changeVisibilty={changeAppVisibiltyHandler}
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
