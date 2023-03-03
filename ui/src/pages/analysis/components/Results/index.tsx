import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useParams, useHistory } from 'react-router-dom';
import Datetime from 'react-datetime';
import { Form } from 'semantic-ui-react';
import moment from 'moment';
import dayjs from 'dayjs';
import SectionTitle from 'components/SectionTitle';
import NoData from 'components/NoData';
import Button from 'components/Button';
import Icon from 'components/Icon';
import Modal from 'components/Modal';
import TextLimit from 'components/TextLimit';
import message from 'components/MessageBox';
import ResultTable from './components/table';
import { IChart } from './components/chart';
import TimeLine from './components/timeline';
import canlendar from 'images/calendar.svg';
import { getEventAnalysis, operateCollection, getMetricIterations } from 'services/analysis';
import { IChartData, IEvent, IEventAnalysis, IDistribution, ITableData, IAnalysisItem, IMetricIteration } from 'interfaces/analysis';
import { IRouterParams } from 'interfaces/project';
import { ITarget } from 'interfaces/targeting';
import { CUSTOM, CONVERSION, CLICK, PAGE_VIEW, REVENUE, DURATION, COUNT } from '../../constants';
import { useQuery } from 'hooks';

import styles from './index.module.scss';

interface IProps {
  eventInfo?: IEvent;
  targeting?: ITarget;
  trackEvents: boolean;
  allowEnableTrackEvents: boolean;
  submitLoading: boolean;
  initTargeting(): void;
  saveSubmitLoading: React.Dispatch<React.SetStateAction<boolean>>;
  operateTrackCollection(trackEvent: boolean): void;
}

const Results = (props: IProps) => {
  const query = useQuery();
  const { trackEvents, allowEnableTrackEvents, submitLoading, targeting, eventInfo, initTargeting, saveSubmitLoading } = props;
  const [ open, saveOpen ] = useState<boolean>(false);
  const [ isHaveData, saveHaveData ] = useState<boolean>(false);
  const [ start, saveStart ] = useState<string>(query.get('start') ?? '');
  const [ end, saveEnd ] = useState<string>(query.get('end') ?? '');
  const [ result, saveResult ] = useState<IAnalysisItem>();
  const [ chartLabels, saveChartLabels ] = useState<unknown[]>([]);
  const [ chartData, saveChartData ] = useState<IChartData[]>();
  const [ tableData, saveTableData ] = useState<ITableData[]>();
  const [ iterations, saveIterations ] = useState<IMetricIteration[]>([]);
  const { projectKey, environmentKey, toggleKey } = useParams<IRouterParams>();
  const intl = useIntl();
  const history = useHistory();

  const startDateValid = useCallback((current: moment.Moment) => {
    return current.isBefore(moment(end));
  }, [end]);

  const endDateValid = useCallback((current: moment.Moment) => {
    return current.isBefore(moment());
  }, []);

  const getMetricTypeText = useMemo(() => {
    return new Map([
      [CONVERSION, intl.formatMessage({id: 'analysis.event.conversion'})],
      [COUNT, intl.formatMessage({id: 'analysis.event.count'})],
      [REVENUE, intl.formatMessage({id: 'analysis.event.revenue'})],
      [DURATION, intl.formatMessage({id: 'analysis.event.duration'})],
    ]);
  }, [intl]);

  const getEventTypeText = useMemo(() => {
    return new Map([
      [CUSTOM, intl.formatMessage({id: 'analysis.event.custom'})],
      [CLICK, intl.formatMessage({id: 'analysis.event.click'})],
      [PAGE_VIEW, intl.formatMessage({id: 'analysis.event.pageview'})],
    ]);
  }, [intl]);

  useEffect(() => {
    if (!targeting?.variations || !result) {
      return;
    };

    const tableData: ITableData[] = [];
    const chartData: IChartData[] = [];

    if (JSON.stringify(result) !== '{}') {
      saveHaveData(true);
    } else {
      saveHaveData(false);
    }

    let labels: unknown[] = [];

    for (const item in result) {
      chartData.push({
        label: targeting?.variations[Number(item)].name || '',
        data: result[item].distributionChart.map((val: IDistribution) => {
          return val.y;
        })
      });

      tableData.push({
        name: targeting?.variations[Number(item)].name || '',
        mean: result[item].mean,
        winningPercentage: result[item].winningPercentage,
        credibleInterval: result[item].credibleInterval,
        sampleSize: result[item].sampleSize
      });

      labels = result[item].distributionChart.map((val: IDistribution) => {
        return val.x;
      });
  
      saveChartData(chartData);
      saveTableData(tableData);
      saveChartLabels(labels);
    }
  }, [result, targeting?.variations]);

  const getEventResult = useCallback((startParam?: string, endParam?: string) => {
    getEventAnalysis<IEventAnalysis>(projectKey, environmentKey, toggleKey, {
      start: startParam || start,
      end: endParam || end,
    }).then(res => {
      const { success, data } = res;
      if (success && data) {
        saveResult(data.data);
        saveStart(dayjs(data.start).format('YYYY-MM-DD HH:mm:ss'));
        saveEnd(dayjs(data.end).format('YYYY-MM-DD HH:mm:ss'));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentKey, projectKey, toggleKey]);

  const getIteration = useCallback(() => {
    getMetricIterations<IMetricIteration[]>(projectKey, environmentKey, toggleKey).then(res => {
      const { success, data } = res;
      if (success && data) {
        saveIterations(data);
      }
    });
  }, [environmentKey, projectKey, toggleKey]);

  useEffect(() => {
    getEventResult();
    getIteration();
  }, [getEventResult, getIteration]);

  const operateTrackCollection = useCallback(trackEvents => {
    saveSubmitLoading(true);
    operateCollection(projectKey, environmentKey, toggleKey, {
      trackAccessEvents: trackEvents
    }).then(res => {
      if (res.success) {
        initTargeting();
        getEventResult(start, end);
      } else {
        message.error(intl.formatMessage({id: 'targeting.approval.operate.error'}));
      }
      saveSubmitLoading(false);
    });
  }, [saveSubmitLoading, projectKey, environmentKey, toggleKey, initTargeting, getEventResult, start, end, intl]);

  return (
    <div className={`result ${styles.result}`}>
      <SectionTitle title={intl.formatMessage({ id: 'common.data.text' })} showTooltip={false} />
      <div className={styles.start}>
        {
          !trackEvents ? (
            <Button
              primary
              size='mini'
              loading={submitLoading}
              className={styles['start-btn']}
              disabled={!allowEnableTrackEvents}
              onClick={() => {
                if (isHaveData) {
                  saveOpen(true);
                } else {
                  operateTrackCollection(true);
                  getIteration();
                }
              }}
            >
              <FormattedMessage id="analysis.result.collect.start" />
            </Button>
          ) : (
            <Button
              secondary
              size='mini'
              loading={submitLoading}
              className={styles['start-btn']}
              onClick={() => {
                operateTrackCollection(false);
                getIteration();
              }}
            >
              <FormattedMessage id="analysis.result.collect.stop" />
            </Button>
          )
        }
      </div>

      {
        !eventInfo && (
          <div className={styles.tips}>
            <Icon customclass={styles['warning-circle']} type="warning-circle" />
            <FormattedMessage id="analysis.result.tip" />
          </div>
        )
      }

      {
        iterations.length > 0 && (
          <TimeLine 
            iterations={iterations}
          />
        )
      }

      <div className={styles['result-content']}>
        {
          eventInfo && (
            <Form className={styles['result-content-header']}>
              <Form.Group>
                <Form.Field>
                  <div className={styles['table-header']}>
                    <div className={styles['metric-name']}>
                      <TextLimit text={eventInfo?.name ?? ''} maxLength={20} />
                    </div>
                    <div className={styles['type']}>
                      {getMetricTypeText.get(eventInfo?.metricType ?? '')}
                      {' - '}
                      {getEventTypeText.get(eventInfo?.eventType ?? '')}
                    </div>
                  </div>
                </Form.Field>
                <Form.Field
                  inline
                  className={styles['datetime']}
                >
                  <label className={styles['datetime-label']}>
                    <FormattedMessage id='anylysis.result.start.time' />
                  </label>
                  <Datetime
                    dateFormat='YYYY-MM-DD'
                    timeFormat='HH:mm:ss'
                    inputProps={{
                      placeholder: intl.formatMessage({id: 'anylysis.result.start.time'}),
                    }}
                    value={moment(start)}
                    isValidDate={startDateValid}
                    onChange={async (e: string | moment.Moment) => {
                      if (!startDateValid(e as moment.Moment)) {
                        return;
                      }
                      const current = (e as moment.Moment).format('YYYY-MM-DD HH:mm:ss');
                      saveStart(current);
                      getEventResult(current, end);
                      history.push(`/${projectKey}/${environmentKey}/${toggleKey}/analysis?start=${current}&end=${end}`);
                    }}
                  />
                  <img src={canlendar} alt='canlendar' className={styles['datetime-calendar']} />
                </Form.Field>
                <span className={styles['datetime-divider']}>-</span>
                <Form.Field
                  className={styles['datetime']}
                >
                  <label className={styles['datetime-label']}>
                    <FormattedMessage id='anylysis.result.end.time' />
                  </label>
                  <Datetime
                    dateFormat='YYYY-MM-DD'
                    timeFormat='HH:mm:ss'
                    inputProps={{
                      placeholder: intl.formatMessage({id: 'anylysis.result.end.time'}),
                    }}
                    value={moment(end)}
                    isValidDate={endDateValid}
                    onChange={async (e: string | moment.Moment) => {
                      if (!endDateValid(e as moment.Moment)) {
                        return;
                      }
                      const current = (e as moment.Moment).format('YYYY-MM-DD HH:mm:ss');
                      saveEnd(current);
                      getEventResult(start, current);
                      history.push(`/${projectKey}/${environmentKey}/${toggleKey}/analysis?start=${start}&end=${current}`);
                    }}
                  />
                  <img src={canlendar} alt='canlendar' className={styles['datetime-calendar']} />
                </Form.Field>
              </Form.Group>
            </Form>
          )
        }
        
        {
          isHaveData ? (
            <ResultTable 
              data={tableData}
              eventInfo={eventInfo}
            />
          ) : (
            <div className={styles['no-data']}>
              <NoData />
            </div>
          )
        }
      </div>

      {
        isHaveData && chartData && (
          <div className={styles['analysis-chart']}>
            <IChart labels={chartLabels} datasets={chartData} />
          </div>
        )
      }

      <Modal
        open={open}
        width={308}
        handleCancel={() => {
          saveOpen(false);
        }}
        handleConfirm={() => {
          operateTrackCollection(true);
          saveOpen(false);
          getIteration();
        }}
      >
        <div>
          <div className={styles['modal-header']}>
            <Icon customclass={styles['modal-warning-circle']} type='warning-circle' />
            <span className={styles['modal-header-text']}>
              <FormattedMessage id='analysis.result.collect.tip' />
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Results;
