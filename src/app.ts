import { App, LogLevel } from '@slack/bolt';
import { VercelReceiver } from './receiver/vercelReceiver';
import { registerAddTask } from './commands/addTask';
import { registerNextTask } from './commands/nextTask';
import { registerAllTasks } from './commands/allTasks';
import { registerCreateTaskShortcut } from './shortcuts/createTaskFromMessage';
import { registerEditTaskButton } from './actions/editTaskButton';
import { registerDeleteTaskButton } from './actions/deleteTaskButton';
import { registerNextTaskQuickActions } from './actions/nextTaskQuickActions';
import { registerAddTaskModalSubmit } from './views/addTaskModal';
import { registerEditTaskModalSubmit } from './views/editTaskModal';

export const receiver = new VercelReceiver();

export const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
  logLevel: LogLevel.INFO,
});

registerAddTask(app);
registerNextTask(app);
registerAllTasks(app);
registerCreateTaskShortcut(app);
registerEditTaskButton(app);
registerDeleteTaskButton(app);
registerNextTaskQuickActions(app);
registerAddTaskModalSubmit(app);
registerEditTaskModalSubmit(app);
