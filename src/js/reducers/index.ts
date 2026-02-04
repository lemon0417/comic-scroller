// @flow
import { combineReducers } from 'redux';
import comics from './comics';

const rootReducer = combineReducers({
  comics: comics as any,
});

export default rootReducer;
