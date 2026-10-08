import { LayouterRepository } from '../../../services/layouter/layouter-repository';
import { UMLElementActionTypes, UpdateAction } from '../../../services/uml-element/uml-element-types';
import { AsyncAction } from '../../../utils/actions/actions';
import { IBoundary } from '../../../utils/geometry/boundary';

type Lane = { id: string; bounds: IBoundary };

/** Swaps the vertical positions of two lanes of a pool and re-runs the layout. */
export const swapLanes =
  (laneA: Lane, laneB: Lane): AsyncAction =>
  (dispatch) => {
    dispatch<UpdateAction>({
      type: UMLElementActionTypes.UPDATE,
      payload: {
        values: [
          { id: laneA.id, bounds: { ...laneA.bounds, y: laneB.bounds.y } },
          { id: laneB.id, bounds: { ...laneB.bounds, y: laneA.bounds.y } },
        ],
      },
      undoable: false,
    });
    dispatch(LayouterRepository.layout());
  };
