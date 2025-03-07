import React from 'react';
import {findDOMNode} from 'react-dom';
import {isAlive} from 'mobx-state-tree';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';

import {ScopedContext, IScopedContext} from 'amis-core';
import {Renderer, RendererProps} from 'amis-core';
import {ActionObject} from 'amis-core';
import {Icon, Table} from 'amis-ui';
import {BaseSchema, SchemaObject, SchemaTokenizeableString} from '../../Schema';
import {
  isObject,
  anyChanged,
  difference,
  createObject,
  autobind
} from 'amis-core';
import {
  resolveVariableAndFilter,
  isPureVariable,
  resolveVariable
} from 'amis-core';
import {evalExpression, filter} from 'amis-core';
import {isEffectiveApi} from 'amis-core';
import {Checkbox} from 'amis-ui';
import {BadgeObject} from 'amis-ui';
import {TableStoreV2, ITableStoreV2, IColumnV2, IRowV2} from 'amis-core';

import {HeadCellSearchDropDown} from './HeadCellSearchDropdown';
import './TableCell';
import './ColumnToggler';
import type {SortProps} from 'amis-ui/lib/components/table';
import { Action } from '../../types';

/**
 * Table 表格v2渲染器。
 * 文档：https://baidu.gitee.io/amis/docs/components/table-v2
 */

export interface CellSpan {
  colIndex: number;
  rowIndex: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface RenderProps {
  colSpan?: number;
  rowSpan?: number;
}

export interface ColumnSchema {
  /**
   * 指定列唯一标识
   */
  key: string;

  /**
   * 指定列标题
   */
  title: string | SchemaObject;

  /**
   * 指定列内容渲染器
   */
  type?: string;

  /**
   * 指定行合并表达式
   */
  rowSpanExpr?: string;

  /**
   * 指定列合并表达式
   */
  colSpanExpr?: string;

  /**
   * 表头分组
   */
  children?: Array<ColumnSchema>;

  /**
   * 可复制
   */
  copyable?: boolean;

  /**
   * 列表头提示
   */
  remark?: string;

  /**
   * 快速搜索
   */
  searchable?: boolean | SchemaObject;

  /**
   * 快速排序
   */
  sorter?: boolean;

  /**
   * 内容居左、居中、居右
   */
  align?: string;

  /**
   * 是否固定在左侧/右侧
   */
  fixed?: boolean | string;

  /**
   * 当前列是否展示
   */
  toggled?: boolean;

  /**
   * 列样式
   */
  className?: string;

  /**
   * 表头单元格样式
   */
  titleClassName?: string;

  /**
   * 单元格样式
   */
  classNameExpr?: string;
}

export interface RowSelectionOptionsSchema {
  /**
   * 选择类型 选择全部
   */
  key: string; // 选择类型 目前只支持all、invert、none、odd、even

  /**
   * 选项显示文本
   */
  text: string;
}

export interface RowSelectionSchema {
  /**
   * 选择类型 单选/多选
   */
  type: string;

  /**
   * 对应数据源的key值
   */
  keyField?: string;

  /**
   * 行是否禁用表达式
   */
  disableOn?: string;

  /**
   * 自定义选择菜单
   */
  selections?: Array<RowSelectionOptionsSchema>;

  /**
   * 已选择的key值
   */
  selectedRowKeys?: Array<string | number>;

  /**
   * 已选择的key值表达式
   */
  selectedRowKeysExpr?: string;

  /**
   * 已选择的key值表达式
   */
  columnWidth?: number;

  /**
   * 是否点击行触发选中或取消选中
   */
  rowClick?: boolean;
}

export interface ExpandableSchema {
  /**
   * 对应渲染器类型
   */
  type: string;

  /**
   * 对应数据源的key值
   */
  keyField: string;

  /**
   * 行是否可展开表达式
   */
  expandableOn: string;

  /**
   * 展开行自定义样式表达式
   */
  expandedRowClassNameExpr: string;

  /**
   * 已展开的key值
   */
  expandedRowKeys: Array<string | number>;

  /**
   * 已展开的key值表达式
   */
  expandedRowKeysExpr: string;
}

export interface TableSchemaV2 extends BaseSchema {
  /**
   * 指定为表格类型
   */
  type: 'table-v2';

  /**
   * 表格标题
   */
  title?: string | SchemaObject | Array<SchemaObject>;

  /**
   * 表格数据源
   */
  source: SchemaTokenizeableString;

  /**
   * 表格可自定义列
   */
  columnsTogglable?: boolean | string | SchemaObject;

  /**
   * 表格列配置
   */
  columns: Array<ColumnSchema>;

  /**
   * 表格可选择配置
   */
  rowSelection?: RowSelectionSchema;

  /**
   * 表格行可展开配置
   */
  expandable?: ExpandableSchema;

  /**
   * 粘性头部
   */
  sticky?: boolean;

  /**
   * 加载中
   */
  loading?: boolean | string | SchemaObject;

  /**
   * 行角标
   */
  itemBadge?: BadgeObject;

  /**
   * 指定挂载dom
   */
  popOverContainer?: any;

  /**
   * 嵌套展开记录的唯一标识
   */
  keyField?: string;

  /**
   * 数据源嵌套自定义字段名
   */
  childrenColumnName?: string;

  /**
   * 自定义行样式
   */
  rowClassNameExpr?: string;

  /**
   * 是否固定内容行高度
   */
  lineHeight?: string;

  /**
   * 是否展示边框
   */
  bordered?: boolean;

  /**
   * 是否展示表头
   */
  showHeader?: boolean;

  /**
   * 自定义表格样式
   */
  className?: string;

  /**
   * 指定表尾
   */
  footer?: string | SchemaObject | Array<SchemaObject>;
}

export type TableV2RendererEvent =
  | 'selected'
  | 'columnSort'
  | 'columnFilter'
  | 'columnSearch'
  | 'columnToggled'
  | 'dragOver';

export type TableV2RendererAction = 'selectAll' | 'clearAll' | 'select';

export interface TableV2Props extends RendererProps {
  title?: string;
  source?: string;
  store: ITableStoreV2;
  togglable: boolean;
}

export default class TableV2 extends React.Component<TableV2Props, object> {
  static contextType = ScopedContext;

  renderedToolbars: Array<string> = [];
  control: any;

  constructor(props: TableV2Props, context: IScopedContext) {
    super(props);

    const scoped = context;
    scoped.registerComponent(this);

    const {store, columnsTogglable, columns} = props;

    store.update({columnsTogglable, columns});
    TableV2.syncRows(store, props, undefined) && this.syncSelected();
  }

  componentWillUnmount() {
    const scoped = this.context as IScopedContext;
    scoped.unRegisterComponent(this);
  }

  @autobind
  controlRef(control: any) {
    // 因为 control 有可能被 n 层 hoc 包裹。
    while (control && control.getWrappedInstance) {
      control = control.getWrappedInstance();
    }

    this.control = control;
  }

  syncSelected() {
    const {store, onSelect} = this.props;

    onSelect &&
      onSelect(
        store.selectedRows.map(item => item.data),
        store.unSelectedRows.map(item => item.data)
      );
  }

  static syncRows(
    store: ITableStoreV2,
    props: TableV2Props,
    prevProps?: TableV2Props
  ) {
    const source = props.source;
    const value = props.value || props.items;
    let rows: Array<object> = [];
    let updateRows = false;

    if (
      Array.isArray(value) &&
      (!prevProps || (prevProps.value || prevProps.items) !== value)
    ) {
      updateRows = true;
      rows = value;
    } else if (typeof source === 'string') {
      const resolved = resolveVariableAndFilter(source, props.data, '| raw');
      const prev = prevProps
        ? resolveVariableAndFilter(source, prevProps.data, '| raw')
        : null;

      if (prev && prev === resolved) {
        updateRows = false;
      } else if (Array.isArray(resolved)) {
        updateRows = true;
        rows = resolved;
      }
    }
    updateRows &&
      store.initRows(
        rows,
        props.getEntryId,
        props.reUseRow,
        props.childrenColumnName
      );

    let selectedRowKeys: Array<string | number> = [];
    // selectedRowKeysExpr比selectedRowKeys优先级高
    if (props.rowSelection && props.rowSelection.selectedRowKeysExpr) {
      rows.forEach((row: any, index: number) => {
        const flag = evalExpression(props.rowSelection.selectedRowKeysExpr, {
          record: row,
          rowIndex: index
        });
        if (flag) {
          selectedRowKeys.push(row[props?.rowSelection?.keyField || 'key']);
        }
      });
    } else if (props.rowSelection && props.rowSelection.selectedRowKeys) {
      selectedRowKeys = [...props.rowSelection.selectedRowKeys];
    }

    if (updateRows && selectedRowKeys.length > 0) {
      store.updateSelected(selectedRowKeys, props.rowSelection.keyField);
    }

    let expandedRowKeys: Array<string | number> = [];
    if (props.expandable && props.expandable.expandedRowKeysExpr) {
      rows.forEach((row: any, index: number) => {
        const flag = evalExpression(props.expandable.expandedRowKeysExpr, {
          record: row,
          rowIndex: index
        });
        if (flag) {
          expandedRowKeys.push(row[props?.expandable?.keyField || 'key']);
        }
      });
    } else if (props.expandable && props.expandable.expandedRowKeys) {
      expandedRowKeys = [...props.expandable.expandedRowKeys];
    }

    if (updateRows && expandedRowKeys.length > 0) {
      store.updateExpanded(expandedRowKeys, props.expandable.keyField);
    }

    return updateRows;
  }

  componentDidUpdate(prevProps: TableV2Props) {
    const props = this.props;
    const store = props.store;

    if (anyChanged(['columnsTogglable'], prevProps, props)) {
      store.update({
        columnsTogglable: props.columnsTogglable
      });
    }

    if (
      anyChanged(['source', 'value', 'items'], prevProps, props) ||
      (!props.value &&
        !props.items &&
        (props.data !== prevProps.data ||
          (typeof props.source === 'string' && isPureVariable(props.source))))
    ) {
      TableV2.syncRows(store, props, prevProps) && this.syncSelected();
    }

    if (!isEqual(prevProps.columns, props.columns)) {
      store.update({
        columns: props.columns
      });
    }
  }

  @autobind
  getPopOverContainer() {
    return findDOMNode(this);
  }

  renderCellSchema(schema: any, props: any) {
    const {render} = this.props;

    // Table Cell SchemaObject转化成ReactNode
    if (schema && isObject(schema)) {
      // 在TableCell里会根据width设置div的width
      // 原来的table td/th是最外层标签 设置width没问题
      // v2的拆开了 就不需要再设置div的width了
      // 否则加上padding 就超出单元格的区域了
      // children属性在schema里是一个关键字 在渲染器schema中 自定义的children没有用 去掉
      const {width, children, ...rest} = schema;
      return render(
        'cell-field',
        {
          ...rest,
          type: 'cell-field',
          column: rest,
          data: props.data,
          name: schema.key
        },
        props
      );
    }

    return schema;
  }

  renderSchema(key: string, schema: any, props?: any) {
    const {render} = this.props;

    // Header、Footer等SchemaObject转化成ReactNode
    if (schema && isObject(schema)) {
      return render(key || 'field', {...schema, data: props.data}, props);
    } else if (Array.isArray(schema)) {
      const renderers: Array<any> = [];
      schema.forEach((s, i) =>
        renderers.push(
          render(
            key || 'field',
            {
              ...s,
              data: props.data
            },
            {...props, key: i}
          )
        )
      );
      return renderers;
    }

    return schema;
  }
  // editor传来的处理过的column 还可能包含其他字段
  buildColumns(columns: Array<any>) {
    const {
      env,
      render,
      store,
      popOverContainer,
      canAccessSuperData,
      showBadge,
      itemBadge,
      classnames: cx
    } = this.props;

    const cols: Array<any> = [];
    const rowSpans: Array<CellSpan> = [];
    const colSpans: Array<CellSpan> = [];

    Array.isArray(columns) &&
      columns.forEach((column, col) => {
        const clone = {...column} as any;

        let titleSchema: any = null;
        const titleProps = {
          popOverContainer: popOverContainer || this.getPopOverContainer,
          value: column.title
        };
        if (isObject(column.title)) {
          titleSchema = cloneDeep(column.title);
        } else if (typeof column.title === 'string') {
          titleSchema = {type: 'plain'};
        }

        const titleRender = (children: any) => {
          const content = this.renderCellSchema(titleSchema, titleProps);

          let remark = null;
          if (column.remark) {
            remark = render('remark', {
              type: 'remark',
              tooltip: column.remark,
              container:
                env && env.getModalContainer ? env.getModalContainer : undefined
            });
          }

          return (
            <div
              key={col}
              className={cx('Table-head-cell-wrapper', {
                [`${column.className}`]: !!column.className,
                [`${column.titleClassName}`]: !!column.titleClassName
              })}
            >
              {content}
              {remark}
              {children}
            </div>
          );
        };

        Object.assign(clone, {
          title: titleRender
        });

        // 设置了type值 就完全按渲染器处理了
        if (column.type) {
          Object.assign(clone, {
            render: (
              text: string,
              record: any,
              rowIndex: number,
              colIndex: number
            ) => {
              const props: RenderProps = {};
              const item = store.getRowByIndex(rowIndex) || {};
              const obj = {
                children: this.renderCellSchema(column, {
                  data: item.locals,
                  value: column.key
                    ? resolveVariable(
                        column.key,
                        canAccessSuperData ? item.locals : item.data
                      )
                    : column.key,
                  popOverContainer:
                    popOverContainer || this.getPopOverContainer,
                  onQuickChange: (
                    values: object,
                    saveImmediately?: boolean,
                    savePristine?: boolean,
                    resetOnFailed?: boolean
                  ) => {
                    this.handleQuickChange(
                      item,
                      values,
                      saveImmediately,
                      savePristine,
                      resetOnFailed
                    );
                  },
                  row: item,
                  showBadge,
                  itemBadge
                }),
                props
              };
              if (column.rowSpanExpr) {
                const rowSpan = +filter(column.rowSpanExpr, {
                  record,
                  rowIndex,
                  colIndex
                });
                if (rowSpan) {
                  obj.props.rowSpan = rowSpan;
                  rowSpans.push({colIndex, rowIndex, rowSpan});
                }
              }

              if (column.colSpanExpr) {
                const colSpan = +filter(column.colSpanExpr, {
                  record,
                  rowIndex,
                  colIndex
                });
                if (colSpan) {
                  obj.props.colSpan = colSpan;
                  colSpans.push({colIndex, rowIndex, colSpan});
                }
              }

              rowSpans.forEach(item => {
                if (
                  colIndex === item.colIndex &&
                  rowIndex > item.rowIndex &&
                  rowIndex < item.rowIndex + (item.rowSpan || 0)
                ) {
                  obj.props.rowSpan = 0;
                }
              });

              colSpans.forEach(item => {
                if (
                  rowIndex === item.rowIndex &&
                  colIndex > item.colIndex &&
                  colIndex < item.colIndex + (item.colSpan || 0)
                ) {
                  obj.props.colSpan = 0;
                }
              });

              return obj;
            }
          });
        }

        // 设置了单元格样式
        if (column.classNameExpr) {
          clone.className = (record: any, rowIndex: number) => {
            const className = filter(column.classNameExpr, {record, rowIndex});
            return `${className}${
              column.className ? ` ${column.className}` : ''
            }`;
          };
        }

        // 设置了列搜索
        if (column.searchable) {
          clone.filterDropdown = (
            <HeadCellSearchDropDown
              {...this.props}
              popOverContainer={this.getPopOverContainer}
              name={column.key}
              searchable={column.searchable}
              orderBy={store.orderBy}
              orderDir={store.order}
              data={store.query}
              key={'th-search-' + col}
              store={store}
            />
          );
        }

        if (column.children) {
          clone.children = this.buildColumns(column.children);
        }

        cols.push(clone);
      });

    return cols;
  }

  buildSummary(key: string, summary: Array<any>) {
    const result: Array<any> = [];
    if (Array.isArray(summary)) {
      summary.forEach((s, index) => {
        if (isObject(s)) {
          result.push({
            colSpan: s.colSpan,
            fixed: s.fixed,
            render: (dataSouce: Array<any>) =>
              this.renderSchema(key, s, {
                data: dataSouce
              })
          });
        } else if (Array.isArray(s)) {
          if (!result[index]) {
            result.push([]);
          }
          s.forEach(d => {
            result[index].push({
              colSpan: d.colSpan,
              fixed: d.fixed,
              render: (dataSouce: Array<any>) =>
                this.renderSchema(key, d, {
                  data: dataSouce
                })
            });
          });
        }
      });
    }

    return result.length ? result : null;
  }

  reloadTarget(target: string, data: any) {
    const scoped = this.context as IScopedContext;
    scoped.reload(target, data);
  }

  @autobind
  handleSave(
    rows: Array<object> | object,
    diff: Array<object> | object,
    indexes: Array<string>,
    unModifiedItems?: Array<any>,
    rowsOrigin?: Array<object> | object,
    resetOnFailed?: boolean
  ) {
    const {
      store,
      quickSaveApi,
      quickSaveItemApi,
      primaryField,
      env,
      messages,
      reload
    } = this.props;

    if (Array.isArray(rows)) {
      if (!isEffectiveApi(quickSaveApi)) {
        env && env.alert('TableV2 quickSaveApi is required');
        return;
      }

      const data: any = createObject(store.data, {
        rows,
        rowsDiff: diff,
        indexes: indexes,
        rowsOrigin
      });

      if (rows.length && rows[0].hasOwnProperty(primaryField || 'id')) {
        data.ids = rows
          .map(item => (item as any)[primaryField || 'id'])
          .join(',');
      }

      if (unModifiedItems) {
        data.unModifiedItems = unModifiedItems;
      }

      store
        .saveRemote(quickSaveApi, data, {
          successMessage: messages && messages.saveFailed,
          errorMessage: messages && messages.saveSuccess
        })
        .then(() => {
          reload && this.reloadTarget(reload, data);
        })
        .catch(() => {});
    } else {
      if (!isEffectiveApi(quickSaveItemApi)) {
        env && env.alert('TableV2 quickSaveItemApi is required!');
        return;
      }

      const data = createObject(store.data, {
        item: rows,
        modified: diff,
        origin: rowsOrigin
      });

      const sendData = createObject(data, rows);
      store
        .saveRemote(quickSaveItemApi, sendData)
        .then(() => {
          reload && this.reloadTarget(reload, data);
        })
        .catch(() => {
          resetOnFailed && this.control.reset();
        });
    }
  }

  @autobind
  handleQuickChange(
    item: IRowV2,
    values: object,
    saveImmediately?: boolean | any,
    savePristine?: boolean,
    resetOnFailed?: boolean
  ) {
    if (!isAlive(item)) {
      return;
    }

    const {onSave, onPristineChange, primaryField, quickSaveItemApi} =
      this.props;

    item.change(values, savePristine);

    // 值发生变化了，需要通过 onSelect 通知到外面，否则会出现数据不同步的问题
    item.modified && this.syncSelected();

    if (savePristine) {
      onPristineChange?.(item.data, item.path);
      return;
    }

    if (saveImmediately && saveImmediately.api) {
      this.props.onAction(
        null,
        {
          actionType: 'ajax',
          api: saveImmediately.api
        },
        values
      );
      return;
    }

    onSave
      ? onSave(
          item.data,
          difference(item.data, item.pristine, ['id', primaryField]),
          item.path,
          undefined,
          item.pristine,
          resetOnFailed
        )
      : this.handleSave(
          quickSaveItemApi ? item.data : [item.data],
          difference(item.data, item.pristine, ['id', primaryField]),
          [item.path],
          undefined,
          item.pristine,
          resetOnFailed
        );
  }

  @autobind
  handleAction(e: React.UIEvent<any>, action: Action, ctx: object) {
    const {onAction} = this.props;

    // todo
    onAction(e, action, ctx);
  }

  renderActions(region: string) {
    let {actions, render, store, classnames: cx, data, columnsTogglable, $path} = this.props;

    // 如果table是在crud里面，自定义显示列配置在grid里，这里就不需要渲染了
    const isInCrud = /(?:\/|^)crud2\//.test($path as string);

    actions = Array.isArray(actions) ? actions.concat() : [];

    // 现在默认从crud里传进来的columnsTogglable是boolean类型
    // table单独配置的是SchemaNode类型
    if (
      !isInCrud &&
      store.toggable &&
      region === 'header' &&
      !~this.renderedToolbars.indexOf('columns-toggler')
    ) {

      actions.push({
        type: 'button',
        children: render('column-toggler', {
          ...(isObject(columnsTogglable) ? columnsTogglable : {}),
          type: 'column-toggler'
        }, {
          cols: store.columnsData.map(item => item.pristine),
          toggleAllColumns: () => store.toggleAllColumns(),
          toggleToggle: (toggled: boolean, index: number) => {
            const column = store.columnsData[index];
            column.toggleToggle();
          }
        })
      });
    }

    return Array.isArray(actions) && actions.length ? (
      <div className={cx('Table-toolbar')}>
        {actions.map((action, key) =>
          render(
            `action/${key}`,
            {
              type: 'button',
              ...(action as any)
            },
            {
              onAction: this.handleAction,
              key,
              btnDisabled: store.dragging,
              data: store.getData(data)
            }
          )
        )}
      </div>
    ) : null;
  }

  @autobind
  async handleSelected(
    selectedRows: Array<any>,
    selectedRowKeys: Array<string | number>,
    unSelectedRows: Array<string | number>
  ) {
    const {dispatchEvent, data, rowSelection, onSelect, store} = this.props;
    const rendererEvent = await dispatchEvent(
      'selectedChange',
      createObject(data, {
        selectedItems: selectedRows,
        unSelectedItems: unSelectedRows
      })
    );

    if (rendererEvent?.prevented) {
      return rendererEvent?.prevented;
    }

    store.updateSelected(selectedRowKeys, rowSelection.keyField);
    onSelect && onSelect(selectedRows, unSelectedRows);
  }

  @autobind
  async handleSort(payload: SortProps) {
    const {dispatchEvent, data, onSort} = this.props;
    const rendererEvent = await dispatchEvent(
      'columnSort',
      createObject(data, {
        orderBy: payload.orderBy,
        orderDir: payload.order
      })
    );

    if (rendererEvent?.prevented) {
      return rendererEvent?.prevented;
    }

    onSort && onSort(payload);
  }

  @autobind
  async handleFilter(payload: {filterName: string; filterValue: string}) {
    const {dispatchEvent, data, onFilter} = this.props;
    const rendererEvent = await dispatchEvent(
      'columnFilter',
      createObject(data, payload)
    );

    if (rendererEvent?.prevented) {
      return rendererEvent?.prevented;
    }

    onFilter && onFilter(payload);
  }

  @autobind
  async handleRowClick(
    event: React.ChangeEvent<any>,
    rowItem: any,
    rowIndex?: number
  ) {
    const {dispatchEvent, data, onRow} = this.props;

    const rendererEvent = await dispatchEvent(
      'rowClick',
      createObject(data, {rowItem})
    );

    if (rendererEvent?.prevented) {
      return rendererEvent?.prevented;
    }

    if (rowItem && onRow) {
      onRow.onRowClick && onRow.onRowClick(event, rowItem, rowIndex);
    }
  }

  @autobind
  async handleOrderChange(
    oldIndex: number,
    newIndex: number,
    levels: Array<string>
  ) {
    const {store} = this.props;
    const rowItem = store.getRowByIndex(oldIndex, levels);

    store.exchange(oldIndex, newIndex, rowItem);
  }

  @autobind
  async handleSaveOrder() {
    const {store, onSaveOrder, data, dispatchEvent} = this.props;

    const movedItems = store.movedRows.map(item => item.data);
    const items = store.rows.map(item => item.getDataWithModifiedChilden());

    const rendererEvent = await dispatchEvent(
      'orderChange',
      createObject(data, {movedItems})
    );

    if (rendererEvent?.prevented) {
      return;
    }

    if (!onSaveOrder || !store.movedRows.length) {
      return;
    }

    onSaveOrder(movedItems, items);
  }

  @autobind
  reset() {
    const {store} = this.props;

    store.reset();
  }

  doAction(action: ActionObject, args: any, throwErrors: boolean): any {
    const {store, rowSelection, data} = this.props;

    const actionType = action?.actionType as string;
    const keyField = rowSelection?.keyField;

    switch (actionType) {
      case 'selectAll':
        store.updateSelectedAll(keyField);
        break;
      case 'clearAll':
        store.updateSelected([], keyField);
        break;
      case 'select':
        const dataSource = store.getData(data);
        const selected: Array<any> = [];
        dataSource.items.forEach((item: any, rowIndex: number) => {
          const flag = evalExpression(args?.selectedRowKeysExpr, {
            record: item,
            rowIndex
          });
          if (flag) {
            selected.push(item[keyField]);
          }
        });
        store.updateSelected(selected, keyField);
        break;
      default:
        break;
    }
  }

  renderTable() {
    const {
      render,
      title,
      footer,
      rowSelection,
      columns,
      expandable,
      expandableBody,
      footSummary,
      headSummary,
      loading,
      classnames: cx,
      placeholder,
      rowClassNameExpr,
      itemActions,
      onRow,
      store,
      ...rest
    } = this.props;

    let expandableConfig: any = null;
    if (expandable) {
      const {expandedRowKeys, ...rest} = expandable;

      expandableConfig = {
        expandedRowKeys: store.currentExpandedKeys,
        ...rest
      };

      if (expandable.expandableOn) {
        expandableConfig.rowExpandable = (record: any, rowIndex: number) =>
          evalExpression(expandable.expandableOn, {record, rowIndex});
        delete expandableConfig.expandableOn;
      }

      if (expandable && expandable.type) {
        expandableConfig.expandedRowRender = (record: any, rowIndex: number) =>
          this.renderSchema('expandableBody', {...expandable}, {data: record});
      }

      if (expandable.expandedRowClassNameExpr) {
        expandableConfig.expandedRowClassName = (
          record: any,
          rowIndex: number
        ) => filter(expandable.expandedRowClassNameExpr, {record, rowIndex});
        delete expandableConfig.expandedRowClassNameExpr;
      }
    }

    let rowSelectionConfig: any = null;
    if (rowSelection) {
      const {selectedRowKeys, selections, ...rest} = rowSelection;
      rowSelectionConfig = {
        selectedRowKeys: store.currentSelectedRowKeys,
        ...rest
      };

      if (rowSelection.disableOn) {
        const disableOn = rowSelection.disableOn;

        rowSelectionConfig.getCheckboxProps = (
          record: any,
          rowIndex: number
        ) => ({
          disabled: evalExpression(disableOn, {record, rowIndex})
        });

        delete rowSelectionConfig.disableOn;
      }

      if (selections && Array.isArray(selections)) {
        rowSelectionConfig.selections = [];

        selections.forEach((item: RowSelectionOptionsSchema) => {
          rowSelectionConfig.selections.push({
            key: item.key,
            text: item.text,
            onSelect: (changableRowKeys: Array<string | number>) => {
              let newSelectedRowKeys = [];
              newSelectedRowKeys = changableRowKeys.filter((key, index) => {
                if (item.key === 'all') {
                  return true;
                }
                if (item.key === 'none') {
                  return false;
                }
                if (item.key === 'invert') {
                  return !store.currentSelectedRowKeys.includes(key);
                }
                // 奇数行
                if (item.key === 'odd') {
                  if (index % 2 !== 0) {
                    return false;
                  }
                  return true;
                }
                // 偶数行
                if (item.key === 'even') {
                  if (index % 2 !== 0) {
                    return true;
                  }
                  return false;
                }
                return true;
              });
              store.updateSelected(newSelectedRowKeys, rowSelection.keyField);
            }
          });
        });
      }
    }

    let rowClassName = undefined;
    // 设置了行样式
    if (rowClassNameExpr) {
      rowClassName = (record: any, rowIndex: number) => {
        return filter(rowClassNameExpr, {record, rowIndex});
      };
    }

    let itemActionsConfig = undefined;
    if (itemActions) {
      const finalActions = Array.isArray(itemActions)
        ? itemActions.filter(action => !action.hiddenOnHover)
        : [];

      if (!finalActions.length) {
        return null;
      }

      itemActionsConfig = (record: any, rowIndex: number) => {
        return (
          <div className={cx('Table-itemActions')}>
            {finalActions.map((action, index) =>
              render(
                `itemAction/${index}`,
                {
                  ...(action as any),
                  isMenuItem: true
                },
                {
                  key: index,
                  item: record,
                  data: record,
                  rowIndex
                }
              )
            )}
          </div>
        );
      };
    }

    return (
      <Table
        {...rest}
        title={this.renderSchema('title', title, {data: this.props.data})}
        footer={this.renderSchema('footer', footer, {data: this.props.data})}
        columns={this.buildColumns(store.filteredColumns)}
        dataSource={store.dataSource}
        rowSelection={rowSelectionConfig}
        rowClassName={rowClassName}
        expandable={expandableConfig}
        footSummary={this.buildSummary('footSummary', footSummary)}
        headSummary={this.buildSummary('headSummary', headSummary)}
        loading={this.renderSchema('loading', loading)}
        placeholder={this.renderSchema('placeholder', placeholder)}
        onSelect={this.handleSelected}
        onSelectAll={this.handleSelected}
        onSort={this.handleSort}
        onFilter={this.handleFilter}
        onDrag={this.handleOrderChange}
        itemActions={itemActionsConfig}
        onRow={{
          ...onRow,
          onRowClick: this.handleRowClick
        }}
      ></Table>
    );
  }

  renderHeading() {
    let {store, classnames: cx, headingClassName, translate: __} = this.props;

    if (store.moved) {
      return (
        <div className={cx('Table-heading', headingClassName)} key="heading">
          {store.moved ? (
            <span>
              {__('Table.moved', {
                moved: store.moved
              })}
              <button
                type="button"
                className={cx('Button Button--xs Button--success m-l-sm')}
                onClick={this.handleSaveOrder}
              >
                <Icon icon="check" className="icon m-r-xs" />
                {__('Form.submit')}
              </button>
              <button
                type="button"
                className={cx('Button Button--xs Button--danger m-l-sm')}
                onClick={this.reset}
              >
                <Icon icon="close" className="icon m-r-xs" />
                {__('Table.discard')}
              </button>
            </span>
          ) : null}
        </div>
      );
    }

    return null;
  }

  render() {
    const {classnames: cx} = this.props;

    this.renderedToolbars = []; // 用来记录哪些 toolbar 已经渲染了

    const heading = this.renderHeading();

    return (
      <div className={cx('Table-render-wrapper')}>
        {this.renderActions('header')}
        {heading}
        {this.renderTable()}
      </div>
    );
  }
}

@Renderer({
  type: 'table-v2',
  storeType: TableStoreV2.name,
  name: 'table-v2',
  isolateScope: true
})
export class TableRenderer extends TableV2 {
  receive(values: any, subPath?: string) {
    const scoped = this.context as IScopedContext;
    const parents = scoped?.parent?.getComponents();

    /**
     * 因为Table在scope上注册，导致getComponentByName查询组件时会优先找到Table，和CRUD联动的动作都会失效
     * 这里先做兼容处理，把动作交给上层的CRUD处理
     */
    if (Array.isArray(parents) && parents.length) {
      // CRUD的name会透传给Table，这样可以保证找到CRUD
      const crud = parents.find(cmpt => cmpt?.props?.name === this.props?.name);

      return crud?.receive?.(values, subPath);
    }

    if (subPath) {
      return scoped.send(subPath, values);
    }
  }
}
