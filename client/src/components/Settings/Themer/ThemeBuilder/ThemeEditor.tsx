import { Fragment } from 'react';

// Redux
import { useSelector, useDispatch } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Theme } from '../../../../interfaces';
import { actionCreators } from '../../../../store';
import { State } from '../../../../store/reducers';

// Other
import { ActionIcons, CompactTable, Icon, ModalForm } from '../../../UI';

// i18n
import { useT } from '../../../../i18n';

interface Props {
  modalHandler: () => void;
}

export const ThemeEditor = (props: Props): JSX.Element => {
  const t = useT();

  const {
    theme: { userThemes },
  } = useSelector((state: State) => state);

  const { deleteTheme, editTheme } = bindActionCreators(
    actionCreators,
    useDispatch()
  );

  const updateHandler = (theme: Theme) => {
    props.modalHandler();
    editTheme(theme);
  };

  const deleteHandler = (theme: Theme) => {
    if (window.confirm(t('theme.deleteThemeConfirm'))) {
      deleteTheme(theme.name);
    }
  };

  return (
    <ModalForm formHandler={() => {}} modalHandler={props.modalHandler}>
      <CompactTable headers={[t('ui.name'), t('ui.actions')]}>
        {userThemes.map((userTheme, idx) => (
          <Fragment key={idx}>
            <span>{userTheme.name}</span>
            <ActionIcons>
              <span onClick={() => updateHandler(userTheme)}>
                <Icon icon="mdiPencil" />
              </span>
              <span onClick={() => deleteHandler(userTheme)}>
                <Icon icon="mdiDelete" />
              </span>
            </ActionIcons>
          </Fragment>
        ))}
      </CompactTable>
    </ModalForm>
  );
};
