// Zod's own messages ("Required", "at least 3 characters") in the application's language and wording.
import { zodErrorMap } from "@wssto2/vue-core/form";
import { z } from "zod";
import { application } from "../app/production";

z.config({ customError: zodErrorMap(application) });
